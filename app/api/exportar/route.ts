import { NextResponse } from 'next/server'
import { pegarUsuarioLogado } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  try {
    // 1. Autenticação
    const user = await pegarUsuarioLogado()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Busca as gerações do usuário
    const geracoes = await sql`
      SELECT produto, caracteristicas, tom, resultado, criado_em
      FROM geracoes
      WHERE user_id = ${user.id}
      ORDER BY criado_em DESC
    `

    // 3. Gera CSV
    const linhas = [
      // Cabeçalho
      ['Data', 'Produto', 'Caracteristicas', 'Tom', 'Resultado'].join(';'),
      // Dados
      ...geracoes.map((g: any) => {
        const data = new Date(g.criado_em).toLocaleString('pt-BR')
        const produto = String(g.produto).replace(/;/g, ',').replace(/\n/g, ' ')
        const caracteristicas = String(g.caracteristicas || '').replace(/;/g, ',').replace(/\n/g, ' ')
        const tom = String(g.tom || '').replace(/;/g, ',')
        const resultado = String(g.resultado).replace(/;/g, ',').replace(/\n/g, ' ')
        return [data, produto, caracteristicas, tom, resultado].join(';')
      }),
    ]

    const csv = linhas.join('\n')

    // 4. Retorna como arquivo pra download
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="historico-descreveai.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Erro ao exportar:', error)
    return NextResponse.json(
      { error: 'Erro ao gerar arquivo' },
      { status: 500 }
    )
  }
}