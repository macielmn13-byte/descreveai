import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { gerarDescricao } from '@/lib/gemini'

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer()

    // 1. Autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 2. Verifica limite do plano
    const { data: perfil } = await supabase
      .from('perfis')
      .select('plano, geracoes_usadas, limite_geracoes')
      .eq('id', user.id)
      .single()

       if (!perfil) {
      console.log('DEBUG user.id:', user.id)
      console.log('DEBUG user.email:', user.email)

      const { data: todosPerfis, error: errPerfis } = await supabase
        .from('perfis')
        .select('*')

      console.log('DEBUG todosPerfis:', todosPerfis)
      console.log('DEBUG errPerfis:', errPerfis)

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
    await supabase.from('geracoes').insert({
      user_id: user.id,
      produto,
      caracteristicas,
      tom,
      resultado,
    })

    // 6. Incrementa contador
    await supabase
      .from('perfis')
      .update({ geracoes_usadas: perfil.geracoes_usadas + 1 })
      .eq('id', user.id)

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