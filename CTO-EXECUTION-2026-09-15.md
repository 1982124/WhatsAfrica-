# WASSAFRICA — Omni CTO execution log — 2026-09-15

## P0 — E2EE media/key recovery

### Root cause addressed
A conversation device can exist without a `conversation_key_envelopes` row for an historical `key_version`. The previous client path could then create a new epoch for the device, while historical messages remained encrypted with an older version. This leaves the UI unable to decrypt historical text/media and produces the observed key-unavailable state.

### Implemented
- Added `conversation_key_requests` with per-conversation/per-device/per-key-version uniqueness.
- Added RLS so only authenticated conversation members can read requests; inserts are restricted to the requester's own active device.
- Added Realtime publication for key requests.
- Added a browser-side recovery worker that:
  - detects missing historical key versions;
  - requests the missing envelope for the current device;
  - re-wraps an existing member device's key to the requester device using RSA-OAEP;
  - polls for fulfillment and rechecks the conversation.
- Loaded recovery worker only on canonical inbox routes.

### Safety boundary
This does not disable E2EE and does not expose plaintext keys to the server. The server stores only the requester-targeted wrapped key supplied by an authenticated conversation member client.

### Certification status
NOT PRODUCTION CERTIFIED yet. A real A→B→A test with two authenticated sessions/devices is still required, including historical media recovery, refresh, reconnect, and new-device scenarios.
