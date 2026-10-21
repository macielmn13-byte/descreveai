import '../helpers/env.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resetConfig } from '../../src/core/config.js';
import {
  encryptBuffer,
  decryptBuffer,
  encryptText,
  decryptText,
  resetKeyring,
  safeIncludes,
  signPayload,
  verifySignature,
  DecryptionError,
} from '../../src/core/security.js';

test('criptografia AES-256-GCM: ida e volta', () => {
  const data = Buffer.from('conteúdo confidencial – CNPJ 11.222.333/0001-81');
  const enc = encryptBuffer(data);
  assert.ok(!enc.includes(data));
  assert.deepEqual(decryptBuffer(enc), data);
  assert.equal(decryptText(encryptText('olá')), 'olá');
});

test('conteúdo adulterado é rejeitado', () => {
  const enc = encryptBuffer(Buffer.from('abc'));
  enc[enc.length - 1] ^= 0xff;
  assert.throws(() => decryptBuffer(enc), DecryptionError);
});

test('rotação de chaves: chave antiga continua descriptografando', () => {
  const oldKey = process.env.ENCRYPTION_KEYS;
  const encOld = encryptBuffer(Buffer.from('antigo'));
  const newKey = crypto.randomBytes(32).toString('base64');
  process.env.ENCRYPTION_KEYS = `${newKey},${oldKey}`;
  resetConfig();
  resetKeyring();
  assert.equal(decryptBuffer(encOld).toString(), 'antigo');
  const encNew = encryptBuffer(Buffer.from('novo'));
  process.env.ENCRYPTION_KEYS = oldKey; // sem a chave nova
  resetConfig();
  resetKeyring();
  assert.throws(() => decryptBuffer(encNew), /Chave de criptografia não encontrada/);
});

test('comparação de credenciais e assinatura HMAC', () => {
  assert.ok(safeIncludes('a', ['b', 'a']));
  assert.ok(!safeIncludes('c', ['a', 'b']));
  assert.ok(!safeIncludes(undefined, ['a']));
  const sig = signPayload('{"x":1}', 'segredo', '1700000000');
  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
  assert.ok(verifySignature('{"x":1}', 'segredo', '1700000000', sig));
  assert.ok(!verifySignature('{"x":2}', 'segredo', '1700000000', sig));
});
