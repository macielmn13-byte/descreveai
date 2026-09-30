'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [modo, setModo] = useState<'login' | 'cadastro'>('login')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setLoading(true)

    try {
      const rota = modo === 'cadastro' ? '/api/cadastro' : '/api/login'

      const res = await fetch(rota, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMsg(`Erro: ${data.error || 'Erro desconhecido'}`)
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      setMsg('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-sm w-full bg-white p-6 rounded-lg shadow space-y-4">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold">
            DescreveAí
          </Link>
          <h1 className="text-lg mt-4 font-semibold">
            {modo === 'login' ? 'Entrar na sua conta' : 'Criar uma conta'}
          </h1>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input
              type="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-lg disabled:opacity-50"
          >
            {loading
              ? 'Aguarde...'
              : modo === 'login'
              ? 'Entrar'
              : 'Criar conta'}
          </button>
        </form>

        {msg && (
          <div
            className={`text-sm p-2 rounded ${
              msg.startsWith('Erro')
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            }`}
          >
            {msg}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'login' ? 'cadastro' : 'login')
            setMsg('')
          }}
          className="w-full text-sm text-blue-600 hover:underline"
        >
          {modo === 'login'
            ? 'Não tem conta? Cadastre-se'
            : 'Já tem conta? Entrar'}
        </button>
      </div>
    </div>
  )
}
