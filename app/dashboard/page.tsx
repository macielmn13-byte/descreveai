import { getSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import GeradorForm from '@/components/GeradorForm'

export default async function Dashboard() {
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
    .single()

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-right text-sm">
          <p className="text-gray-500">{user.email}</p>
          <p>
            Plano: <strong>{perfil?.plano || 'free'}</strong> ·{' '}
            {perfil?.geracoes_usadas || 0}/{perfil?.limite_geracoes || 5}
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white shadow">
        <GeradorForm />
      </div>
    </div>
  )
}