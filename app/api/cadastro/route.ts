import { NextRequest, NextResponse } from 'next/server'
import { criarUsuario, fazerLogin } from '@/lib/auth'
import { verificarRateLimit, pegarIP } from '@/lib/rate-limit'

// Valida formato básico de email
function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting (3 cadastros por minuto por IP)
    const ip = pegarIP(req)
    const { permitido, resetEm } = verificarRateLimit(ip, 3, 60 * 1000)

    if (!permitido) {
      const segundos = Math.ceil((resetEm - Date.now()) / 1000)
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${segundos}s.` },
        { status: 429 }
      )
    }

    // 2. Extrai dados
    const { email, senha } = await req.json()

    // 3. Valida entrada
    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (!emailValido(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      )
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // 4. Cria usuário + faz login automático
    await criarUsuario(email, senha)
    await fazerLogin(email, senha)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    // Erro genérico (nunca vaza err.message pro cliente)
    console.error('Erro no cadastro:', err.message)
    return NextResponse.json(
      { error: 'Erro ao cadastrar. Tente novamente.' },
      { status: 400 }
    )
  }
}