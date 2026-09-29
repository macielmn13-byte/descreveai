import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase-server'
import GeradorForm from '@/components/GeradorForm'
import LogoutButton from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

type Perfil = {
  plano: string | null
  geracoes_usadas: number | null
  limite_geracoes: number | null
}

type Geracao = {
  id: string | number
  produto: string
  tom: string | null
  resultado: string
  created_at: string | null
}

export default async function DashboardPage() {
  const supabase = await getSupabaseServer()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: perfil } = await supabase
    .from('perfis')
    .select('plano, geracoes_usadas, limite_geracoes')
    .eq('id', user.id)
    .single<Perfil>()

  const { data: geracoes } = await supabase
    .from('geracoes')
    .select('id, produto, tom, resultado, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<Geracao[]>()

  const plano = perfil?.plano ?? 'free'
  const usadas = perfil?.geracoes_usadas ?? 0
  const limite = perfil?.limite_geracoes ?? 5
  const restantes = Math.max(limite - usadas, 0)
  const percentual = limite > 0 ? Math.min((usadas / limite) * 100, 100) : 0
  const historico = geracoes ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            DescreveAí
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-gray-500">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-label="Gerador de descrições">
          <GeradorForm />
        </section>

        <aside className="space-y-6">
          <div className="bg-white border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Seu plano</h2>
              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  plano === 'pro'
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {plano === 'pro' ? 'Pro' : 'Free'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Gerações usadas</span>
                <span className="font-medium">
                  {usadas} / {limite}
                </span>
              </div>
              <div
                className="h-2 w-full bg-gray-100 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={usadas}
                aria-valuemin={0}
                aria-valuemax={limite}
              >
                <div
                  className="h-full bg-black rounded-full transition-all"
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {restantes} {restantes === 1 ? 'geração restante' : 'gerações restantes'} este mês
              </p>
            </div>

            {plano !== 'pro' && (
              <Link
                href="/#planos"
                className="block text-center bg-black text-white text-sm py-2 rounded-lg hover:bg-gray-800 transition"
              >
                Fazer upgrade para Pro
              </Link>
            )}
          </div>

          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-bold text-lg mb-4">Histórico recente</h2>
            {historico.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhuma descrição gerada ainda. Crie a primeira ao lado.
              </p>
            ) : (
              <ul className="space-y-4">
                {historico.map((g) => (
                  <li key={g.id} className="border-b last:border-b-0 pb-3 last:pb-0">
                    <p className="font-medium text-sm truncate">{g.produto}</p>
                    <p className="text-xs text-gray-500 mb-1">
                      {g.tom ?? 'profissional'}
                      {g.created_at
                        ? ` · ${new Date(g.created_at).toLocaleDateString('pt-BR')}`
                        : ''}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {g.resultado}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}
