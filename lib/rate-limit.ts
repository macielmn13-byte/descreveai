// ============================================
// RATE LIMITING SIMPLES (em memória)
// ============================================
// 
// Protege APIs contra abuso e força bruta.
// Usa Map em memória do Node.js.
// 
// ⚠️ Limitação: funciona apenas em 1 instância do servidor.
// Pra produção com várias instâncias, migrar pra Upstash Redis.

type Registro = {
  contagem: number
  resetEm: number
}

const tentativas = new Map<string, Registro>()

// Limpa entradas antigas a cada 5 minutos (evita vazamento de memória)
setInterval(() => {
  const agora = Date.now()
  for (const [chave, registro] of tentativas.entries()) {
    if (registro.resetEm < agora) {
      tentativas.delete(chave)
    }
  }
}, 5 * 60 * 1000)

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================
export function verificarRateLimit(
  identificador: string,
  limite: number = 10,
  janelaMs: number = 60 * 1000
): { permitido: boolean; restantes: number; resetEm: number } {
  const agora = Date.now()
  const registro = tentativas.get(identificador)

  // Primeira vez ou janela expirou → cria novo registro
  if (!registro || registro.resetEm < agora) {
    tentativas.set(identificador, {
      contagem: 1,
      resetEm: agora + janelaMs,
    })
    return {
      permitido: true,
      restantes: limite - 1,
      resetEm: agora + janelaMs,
    }
  }

  // Janela ainda ativa → incrementa
  registro.contagem++

  // Passou do limite
  if (registro.contagem > limite) {
    return {
      permitido: false,
      restantes: 0,
      resetEm: registro.resetEm,
    }
  }

  // Dentro do limite
  return {
    permitido: true,
    restantes: limite - registro.contagem,
    resetEm: registro.resetEm,
  }
}

// ============================================
// HELPER: pega o IP do cliente
// ============================================
export function pegarIP(req: Request): string {
  // Tenta pegar do header (Vercel coloca o IP real aqui)
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // Fallback
  const realIP = req.headers.get('x-real-ip')
  if (realIP) return realIP

  return 'desconhecido'
}