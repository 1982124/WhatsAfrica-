import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

function normalizeStatus(value: unknown) {
  const s = String(value ?? "").toLowerCase();
  if (["paid", "success", "successful", "succeeded", "completed", "complete"].includes(s)) return "paid";
  if (["failed", "failure", "rejected", "declined", "error"].includes(s)) return "failed";
  if (["cancelled", "canceled", "expired"].includes(s)) return "cancelled";
  return "pending";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("WA_PAYMENT_WEBHOOK_SECRET") ?? "";
  if (!secret) return json({ error: "webhook_not_configured" }, 503);

  const raw = await req.text();
  const signature = req.headers.get("x-wa-signature") ?? req.headers.get("x-webhook-signature") ?? "";
  if (!signature) return json({ error: "missing_signature" }, 401);
  const expected = await hmacSha256(secret, raw);
  const supplied = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!constantTimeEqual(supplied, expected)) return json({ error: "invalid_signature" }, 401);

  let body: any;
  try { body = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }

  const provider = String(body.provider ?? req.headers.get("x-payment-provider") ?? "unknown").toLowerCase();
  const providerEventId = String(body.provider_event_id ?? body.event_id ?? req.headers.get("x-provider-event-id") ?? "").trim();
  if (!providerEventId) return json({ error: "missing_provider_event_id" }, 400);

  const intentId = body.intent_id ? String(body.intent_id) : null;
  const providerReference = body.provider_reference ? String(body.provider_reference) : (body.transaction_id ? String(body.transaction_id) : null);
  const status = normalizeStatus(body.status ?? body.event_type);
  const eventType = String(body.event_type ?? status);
  const transactionId = body.transaction_id ? String(body.transaction_id) : providerReference;
  const amount = body.amount == null ? null : Number(body.amount);
  const currency = body.currency ? String(body.currency).toUpperCase() : null;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const payloadHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));

  const { data: event, error: eventError } = await db.from("payment_events").insert({
    provider, provider_event_id: providerEventId, event_type: eventType, transaction_id: transactionId,
    status, payload_hash: hex(payloadHash), received_at: new Date().toISOString(),
  }).select("id").single();
  if (eventError) {
    if (eventError.code === "23505") return json({ ok: true, duplicate: true });
    console.error("payment event insert failed", eventError);
    return json({ error: "event_record_failed" }, 500);
  }

  let intent: any = null;
  if (intentId) {
    const result = await db.from("payment_intents").select("id,buyer_id,business_id,order_id,provider,method,currency,amount,status,provider_reference").eq("id", intentId).maybeSingle();
    if (result.error) return json({ error: "intent_lookup_failed" }, 500);
    intent = result.data;
  }
  if (!intent && providerReference) {
    const result = await db.from("payment_intents").select("id,buyer_id,business_id,order_id,provider,method,currency,amount,status,provider_reference").eq("provider_reference", providerReference).maybeSingle();
    if (result.error) return json({ error: "intent_lookup_failed" }, 500);
    intent = result.data;
  }
  if (!intent) {
    await db.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return json({ ok: true, recorded: true, matched: false });
  }

  if (provider !== String(intent.provider).toLowerCase()) return json({ error: "provider_mismatch" }, 409);
  if (amount !== null && Number(intent.amount) !== amount) return json({ error: "amount_mismatch" }, 409);
  if (currency !== null && String(intent.currency).toUpperCase() !== currency) return json({ error: "currency_mismatch" }, 409);

  const intentUpdate: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (providerReference) intentUpdate.provider_reference = providerReference;
  const { error: intentUpdateError } = await db.from("payment_intents").update(intentUpdate).eq("id", intent.id);
  if (intentUpdateError) return json({ error: "intent_update_failed" }, 500);

  let transaction: any = null;
  if (["paid", "failed", "cancelled"].includes(status)) {
    const tx = await db.from("payment_transactions").upsert({
      business_id: intent.business_id, user_id: intent.buyer_id, amount: intent.amount, currency: intent.currency,
      provider: intent.provider, provider_transaction_id: transactionId, status: status === "paid" ? "paid" : status,
      direction: "in", kind: "purchase",
      metadata: { source: "payment-webhook", intent_id: intent.id, provider_event_id: providerEventId },
    }, { onConflict: "provider,provider_transaction_id" }).select("id,status").single();
    if (tx.error) return json({ error: "transaction_upsert_failed" }, 500);
    transaction = tx.data;
    await db.from("payment_events").update({ processed_at: new Date().toISOString(), transaction_id: transactionId }).eq("id", event.id);
  }

  return json({ ok: true, recorded: true, matched: true, intent_id: intent.id, transaction });
});
