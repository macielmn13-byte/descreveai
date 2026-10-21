/**
 * Gera chaves seguras para o arquivo .env (npm run gerar-chaves).
 * Guarde-as em local seguro: sem a ENCRYPTION_KEYS os documentos
 * armazenados NÃO podem ser recuperados.
 */
import crypto from 'node:crypto';

const b64 = (n) => crypto.randomBytes(n).toString('base64');
const url = (n) => crypto.randomBytes(n).toString('base64url');

console.log('# Cole no seu .env');
console.log(`API_KEYS=${url(36)}`);
console.log(`ENCRYPTION_KEYS=${b64(32)}`);
console.log(`EMAIL_WEBHOOK_SECRET=${url(32)}`);
console.log(`WEBHOOK_SECRET=${url(32)}`);
console.log(`POSTGRES_PASSWORD=${url(24)}`);
