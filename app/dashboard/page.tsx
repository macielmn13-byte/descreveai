import { pegarUsuarioLogado } from '@/lib/auth'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import GeradorForm from '@/components/GeradorForm'
import LogoutButton from '@/components/LogoutButton'
import HistoricoGeracoes from '@/components/HistoricoGeracoes'
import Link from 'next/link'
import UpgradeButton from '@/components/UpgradeButton'
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

  const geracoes = await sql`
    SELECT id, produto, resultado, criado_em
    FROM geracoes
    WHERE user_id = ${user.id}
    ORDER BY criado_em DESC
    LIMIT 10
  `

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="text-right text-sm space-y-1">
                   <Link href="/perfil" className="text-sm text-blue-600 hover:underline">
            Meu perfil
          </Link>
          <p className="text-gray-500">{user.email}</p>
          <p>
            Plano: <strong>{perfil?.plano || 'free'}</strong> ·{' '}
            {perfil?.geracoes_usadas || 0}/{perfil?.limite_geracoes || 5}
          </p>
                    <div className="mt-2">
            <UpgradeButton plano={perfil?.plano || 'free'} />
          </div>
          <LogoutButton />
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white shadow">
        <GeradorForm />
      </div>

      <HistoricoGeracoes geracoes={geracoes as any} />
    </div>
  )
}