'use strict';

const dns = require('node:dns/promises');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

const IPV4_BLOCKED = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
];

function ipv4Number(address) {
  return address.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function inIpv4Range(address, network, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(network) & mask);
}

function ipv6Number(address) {
  if (address.includes('%') || address.includes('.')) return null;
  const halves = address.toLowerCase().split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some(x => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return groups.reduce((value, group) => (value << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) return !IPV4_BLOCKED.some(([network, bits]) => inIpv4Range(address, network, bits));
  if (family !== 6) return false;
  const value = ipv6Number(address);
  if (value === null) return false;
  // Only global-unicast 2000::/3 is accepted. Special-purpose, documentation,
  // transition and tunnel ranges are rejected even when they look routable.
  if ((value >> 125n) !== 1n) return false;
  if ((value >> 96n) === 0x20010db8n) return false; // 2001:db8::/32
  if ((value >> 100n) === 0x2001001n) return false; // 2001:10::/28 (ORCHID)
  if ((value >> 112n) === 0x2002n) return false; // 2002::/16 (6to4)
  if ((value >> 96n) === 0x20010000n) return false; // 2001::/32 (Teredo)
  return true;
}

function parseExternalUrl(input) {
  let url;
  try { url = new URL(String(input)); } catch { throw new Error('INVALID_SOURCE_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('INVALID_SOURCE_URL');
  }
  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    throw new Error('INVALID_SOURCE_PORT');
  }
  if (url.href.length > 4096) throw new Error('SOURCE_URL_TOO_LONG');
  url.hash = '';
  return url;
}

async function resolvePublicAddresses(hostname, resolver = dns.lookup) {
  const host = String(hostname).replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error('BLOCKED_SOURCE_HOST');
  }
  const literalFamily = net.isIP(host);
  const addresses = literalFamily
    ? [{ address: host, family: literalFamily }]
    : await resolver(host, { all: true, verbatim: true });
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('SOURCE_DNS_EMPTY');
  if (addresses.some(item => !isPublicAddress(item.address))) throw new Error('BLOCKED_SOURCE_ADDRESS');
  return addresses;
}

async function safeExternalFetch(input, options = {}) {
  const url = parseExternalUrl(input);
  const addresses = await resolvePublicAddresses(url.hostname, options.resolver || dns.lookup);
  const address = addresses[0];
  const transport = url.protocol === 'https:' ? https : http;
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 4 * 1024 * 1024;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 10000;
  const headers = options.headers || {};

  return new Promise((resolve, reject) => {
    let settled = false;
    let total = 0;
    const chunks = [];
    const finish = (error, response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (options.signal) options.signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve(response);
    };
    const onAbort = () => request.destroy(new Error('SOURCE_FETCH_ABORTED'));
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      method: options.method || 'GET',
      path: url.pathname + url.search,
      headers,
      servername: net.isIP(address.address) ? undefined : url.hostname,
      lookup: (_hostname, lookupOptions, callback) => {
        if (lookupOptions && lookupOptions.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      }
    }, response => {
      response.on('data', chunk => {
        total += chunk.length;
        if (total > maxBytes) {
          request.destroy(new Error('SOURCE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        const responseHeaders = response.headers || {};
        finish(null, {
          status: response.statusCode || 0,
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          headers: { get: name => {
            const value = responseHeaders[String(name).toLowerCase()];
            return Array.isArray(value) ? value.join(', ') : (value == null ? null : String(value));
          } },
          arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
          text: async () => body.toString('utf8')
        });
      });
      response.on('error', error => finish(error));
    });
    const timer = setTimeout(() => request.destroy(new Error('SOURCE_FETCH_TIMEOUT')), timeoutMs);
    request.on('error', error => finish(error));
    if (options.signal) {
      if (options.signal.aborted) return onAbort();
      options.signal.addEventListener('abort', onAbort, { once: true });
    }
    request.end();
  });
}

module.exports = { isPublicAddress, parseExternalUrl, resolvePublicAddresses, safeExternalFetch };
