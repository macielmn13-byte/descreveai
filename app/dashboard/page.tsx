import { pegarUsuarioLogado } from '@/lib/auth'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import GeradorForm from '@/components/GeradorForm'
import LogoutButton from '@/components/LogoutButton'

export default async function Dashboard() {
  const user = await pegarUsuarioLogado()

  if (!user) {
    redirect('/login')
  }

  const [perfil] = await sql`
    SELECT plano, geracoes_usadas, limite_geracoes
    FROM perfis
    WHERE user_id = ${user.id}
  `

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-right text-sm space-y-1">
          <p className="text-gray-500">{user.email}</p>
          <p>
            Plano: <strong>{perfil?.plano || 'free'}</strong> ·{' '}
            {perfil?.geracoes_usadas || 0}/{perfil?.limite_geracoes || 5}
          </p>
          <LogoutButton />
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white shadow">
        <GeradorForm />
      </div>
    </div>
  )
}