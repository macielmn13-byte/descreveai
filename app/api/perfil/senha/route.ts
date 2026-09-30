import { NextRequest, NextResponse } from 'next/server'
import { pegarUsuarioLogado, mudarSenha } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = await pegarUsuarioLogado()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { senhaAtual, novaSenha } = await req.json()

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json(
        { error: 'Senha atual e nova senha são obrigatórias' },
        { status: 400 }
      )
    }

    await mudarSenha(user.id, senhaAtual, novaSenha)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro ao mudar senha' },
      { status: 400 }
    )
  }
}