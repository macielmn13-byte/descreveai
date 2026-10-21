/**
 * Autenticação por chave de API (cabeçalho X-API-Key).
 * Várias chaves podem coexistir (API_KEYS separado por vírgula), o que
 * permite trocar a chave de um cliente sem derrubar os demais.
 */
import { getConfig } from '../core/config.js';
import { safeIncludes } from '../core/security.js';

export function requireApiKey(req, res, next) {
  const cfg = getConfig();
  if (!cfg.API_KEYS.length) {
    if (cfg.isProduction) return res.status(503).json({ erro: 'API sem chaves configuradas' });
    return next(); // desenvolvimento sem chaves: acesso livre
  }
  const key = req.get('x-api-key');
  if (!key || !safeIncludes(key, cfg.API_KEYS)) {
    res.set('WWW-Authenticate', 'API-Key');
    return res.status(401).json({ erro: 'Chave de API ausente ou inválida' });
  }
  return next();
}
