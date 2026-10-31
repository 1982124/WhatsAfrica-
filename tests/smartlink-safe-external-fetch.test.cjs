'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPublicAddress, parseExternalUrl, resolvePublicAddresses } = require('../api/_lib/safe-external-fetch');

test('blocks private, loopback, link-local and reserved IPv4 ranges', () => {
  for (const ip of ['0.0.0.0','10.1.2.3','100.64.1.2','127.0.0.1','169.254.1.1','172.16.0.1','172.31.255.254','192.168.1.1','198.18.0.1','224.0.0.1','255.255.255.255']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test('accepts public IPv4 and global IPv6, rejects special IPv6 ranges', () => {
  assert.equal(isPublicAddress('1.1.1.1'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
  for (const ip of ['::1','fe80::1','fc00::1','2001:db8::1','2001:10::1','2002::1','2001::1']) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test('only permits HTTP(S), credential-free URLs and standard ports', () => {
  assert.equal(parseExternalUrl('https://example.com/path').hostname, 'example.com');
  for (const url of ['file:///etc/passwd','ftp://example.com','https://user:pass@example.com','https://example.com:8443']) {
    assert.throws(() => parseExternalUrl(url));
  }
});

test('rejects a DNS response containing any non-public address', async () => {
  await assert.rejects(
    resolvePublicAddresses('example.test', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ]),
    /BLOCKED_SOURCE_ADDRESS/
  );
});

test('pins requests to the vetted DNS answer list', async () => {
  const addresses = await resolvePublicAddresses('example.test', async () => [
    { address: '93.184.216.34', family: 4 }
  ]);
  assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);
});
