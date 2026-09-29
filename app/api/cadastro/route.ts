import { NextRequest, NextResponse } from 'next/server'
import { criarUsuario, fazerLogin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha || senha.length < 6) {
      return NextResponse.json(
        { error: 'Email e senha (mín. 6 caracteres) são obrigatórios' },
        { status: 400 }
      )
    }

    await criarUsuario(email, senha)
    await fazerLogin(email, senha)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao cadastrar' },
      { status: 400 }
    )
  }
}