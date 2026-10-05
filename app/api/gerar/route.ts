import { NextRequest, NextResponse } from 'next/server'
import { pegarUsuarioLogado } from '@/lib/auth'
import { sql } from '@/lib/db'
import { gerarDescricao } from '@/lib/gemini'
import { verificarRateLimit, pegarIP } from '@/lib/rate-limit'

const TONS_VALIDOS = ['profissional', 'descontraido', 'luxo', 'urgencia']
const LIMITES = { produtoMax: 200, caracteristicasMax: 1000 }

export async function POST(req: NextRequest) {
  try {
    const ip = pegarIP(req)
    const { permitido, resetEm } = verificarRateLimit(ip, 10, 60 * 1000)

    if (!permitido) {
      const segundos = Math.ceil((resetEm - Date.now()) / 1000)
      return NextResponse.json(
        { error: `Muitas requisições. Tente novamente em ${segundos}s.` },
        { status: 429 }
      )
    }

    const user = await pegarUsuarioLogado()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const [perfil] = await sql`
      SELECT plano, geracoes_usadas, limite_geracoes
      FROM perfis
      WHERE user_id = ${user.id}
    `

    if (!perfil) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    if (perfil.geracoes_usadas >= perfil.limite_geracoes) {
      return NextResponse.json(
        { error: 'Limite atingido. Faça upgrade para continuar.' },
        { status: 403 }
      )
    }

    const { produto, caracteristicas, tom } = await req.json()

    if (!produto || typeof produto !== 'string') {
      return NextResponse.json({ error: 'Produto inválido' }, { status: 400 })
    }

    const produtoLimpo = produto.trim()

    if (produtoLimpo.length < 3) {
      return NextResponse.json(
        { error: 'Produto deve ter no mínimo 3 caracteres' },
        { status: 400 }
      )
    }

    if (produtoLimpo.length > LIMITES.produtoMax) {
      return NextResponse.json(
        { error: `Produto muito longo (máx ${LIMITES.produtoMax})` },
        { status: 400 }
      )
    }

    if (
      caracteristicas &&
      typeof caracteristicas === 'string' &&
      caracteristicas.length > LIMITES.caracteristicasMax
    ) {
      return NextResponse.json(
        { error: `Características muito longas (máx ${LIMITES.caracteristicasMax})` },
        { status: 400 }
      )
    }

    const tomFinal = TONS_VALIDOS.includes(tom) ? tom : 'profissional'

    const resultado = await gerarDescricao(produtoLimpo, caracteristicas || '', tomFinal)

    await sql`
      INSERT INTO geracoes (user_id, produto, caracteristicas, tom, resultado)
      VALUES (${user.id}, ${produtoLimpo}, ${caracteristicas || ''}, ${tomFinal}, ${resultado})
    `

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