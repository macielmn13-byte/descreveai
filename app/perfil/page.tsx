import { pegarUsuarioLogado } from '@/lib/auth'
import { sql } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PerfilForm from '@/components/PerfilForm'

export default async function PerfilPage() {
  const user = await pegarUsuarioLogado()

  if (!user) {
    redirect('/login')
  }

  const [perfil] = await sql`
    SELECT plano, geracoes_usadas, limite_geracoes, criado_em
    FROM perfis
    WHERE user_id = ${user.id}
  `

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Meu Perfil</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Voltar ao dashboard
        </Link>
      </div>

      <div className="border rounded-lg p-6 bg-white shadow space-y-4">
        <h2 className="text-xl font-bold">Informações da conta</h2>

        <div className="space-y-2">
          <div>
            <span className="text-sm text-gray-500">E-mail:</span>
            <p className="font-medium">{user.email}</p>
          </div>

          <div>
            <span className="text-sm text-gray-500">Plano atual:</span>
            <p>
              <strong className="uppercase">{perfil?.plano || 'free'}</strong>
              {' · '}
              {perfil?.geracoes_usadas || 0}/{perfil?.limite_geracoes || 5} gerações usadas
            </p>
          </div>

          {perfil?.criado_em && (
            <div>
              <span className="text-sm text-gray-500">Conta criada em:</span>
              <p>
                {new Date(perfil.criado_em).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white shadow">
        <PerfilForm />
      </div>
    </div>
  )
}