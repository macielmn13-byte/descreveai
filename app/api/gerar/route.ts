import { NextRequest, NextResponse } from 'next/server'
import { pegarUsuarioLogado } from '@/lib/auth'
import { sql } from '@/lib/db'
import { gerarDescricao } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const user = await pegarUsuarioLogado()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Verifica limite do plano
    const [perfil] = await sql`
      SELECT plano, geracoes_usadas, limite_geracoes
      FROM perfis
      WHERE user_id = ${user.id}
    `

    if (!perfil) {
      return NextResponse.json(
        { error: 'Perfil não encontrado' },
        { status: 404 }
      )
    }

    if (perfil.geracoes_usadas >= perfil.limite_geracoes) {
      return NextResponse.json(
        { error: 'Limite atingido. Faça upgrade para continuar.' },
        { status: 403 }
      )
    }

    // 3. Valida entrada
    const { produto, caracteristicas, tom } = await req.json()

    if (!produto || produto.trim().length < 3) {
      return NextResponse.json({ error: 'Produto inválido' }, { status: 400 })
    }

    // 4. Gera com IA
    const resultado = await gerarDescricao(
      produto,
      caracteristicas || '',
      tom || 'profissional'
    )

    // 5. Salva no banco
    await sql`
      INSERT INTO geracoes (user_id, produto, caracteristicas, tom, resultado)
      VALUES (${user.id}, ${produto}, ${caracteristicas || ''}, ${tom || 'profissional'}, ${resultado})
    `

    // 6. Incrementa contador
    await sql`
      UPDATE perfis
      SET geracoes_usadas = geracoes_usadas + 1
      WHERE user_id = ${user.id}
    `

    return NextResponse.json({
      resultado,
      restantes: perfil.limite_geracoes - perfil.geracoes_usadas - 1,
    })
  } catch (error: any) {
    console.error('Erro ao gerar:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar descrição. Tente novamente.' },
      { status: 500 }
    )
  }
}