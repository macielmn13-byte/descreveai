import { NextRequest, NextResponse } from 'next/server'
import { fazerLogin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, senha } = await req.json()

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    await fazerLogin(email, senha)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao fazer login' },
      { status: 401 }
    )
  }
}