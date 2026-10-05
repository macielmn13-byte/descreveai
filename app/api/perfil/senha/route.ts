import { NextRequest, NextResponse } from 'next/server'
import { pegarUsuarioLogado, mudarSenha } from '@/lib/auth'
import { verificarRateLimit, pegarIP } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting (3 tentativas por minuto por IP — proteção contra força bruta)
    const ip = pegarIP(req)
    const { permitido, resetEm } = verificarRateLimit(ip, 3, 60 * 1000)

    if (!permitido) {
      const segundos = Math.ceil((resetEm - Date.now()) / 1000)
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${segundos}s.` },
        { status: 429 }
      )
    }

    // 2. Autenticação
    const user = await pegarUsuarioLogado()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 3. Extrai dados
    const { senhaAtual, novaSenha } = await req.json()

    // 4. Valida entrada
    if (!senhaAtual || !novaSenha) {
      return NextResponse.json(
        { error: 'Senha atual e nova senha são obrigatórias' },
        { status: 400 }
      )
    }

    if (novaSenha.length < 6) {
      return NextResponse.json(
        { error: 'Nova senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    if (senhaAtual === novaSenha) {
      return NextResponse.json(
        { error: 'Nova senha deve ser diferente da atual' },
        { status: 400 }
      )
    }

    // 5. Muda a senha
    await mudarSenha(user.id, senhaAtual, novaSenha)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Erro genérico (nunca vaza err.message pro cliente)
    console.error('Erro ao mudar senha:', err.message)
    return NextResponse.json(
      { error: 'Erro ao mudar senha. Verifique a senha atual.' },
      { status: 400 }
    )
  }
}