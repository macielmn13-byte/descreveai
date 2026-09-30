'use client'

import { useState } from 'react'

export default function PerfilForm() {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')

    if (novaSenha !== confirmaSenha) {
      setMsg('Erro: As senhas não coincidem')
      return
    }

    if (novaSenha.length < 6) {
      setMsg('Erro: Nova senha deve ter no mínimo 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/perfil/senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMsg(`Erro: ${data.error || 'Erro desconhecido'}`)
        return
      }

      setMsg('Senha alterada com sucesso!')
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmaSenha('')
    } catch {
      setMsg('Erro ao conectar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Alterar senha</h2>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Senha atual</label>
          <input
            type="password"
            placeholder="Digite sua senha atual"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nova senha</label>
          <input
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
            minLength={6}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Confirmar nova senha
          </label>
          <input
            type="password"
            placeholder="Repita a nova senha"
            value={confirmaSenha}
            onChange={(e) => setConfirmaSenha(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
            minLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-6 py-2 rounded-lg disabled:opacity-50"
        >
          {loading ? 'Alterando...' : 'Alterar senha'}
        </button>
      </form>

      {msg && (
        <div
          className={`text-sm p-3 rounded ${
            msg.startsWith('Erro')
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}
        >
          {msg}
        </div>
      )}
    </div>
  )
}