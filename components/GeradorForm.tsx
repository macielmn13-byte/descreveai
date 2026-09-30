'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function GeradorForm() { 
   const [produto, setProduto] = useState('')
  const router = useRouter()
  const [caracteristicas, setCaracteristicas] = useState('')
  const [tom, setTom] = useState('profissional')
  const [resultado, setResultado] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [restantes, setRestantes] = useState<number | null>(null)

  async function gerar() {
    setLoading(true)
    setErro('')
    setResultado('')

    try {
      const res = await fetch('/api/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto, caracteristicas, tom }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro desconhecido')
        return
      }

      setResultado(data.resultado)
      setRestantes(data.restantes)
      

      router.refresh()                     // ← ADICIONA
    }   catch (err) {
  
      setErro('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  function copiar() {
    navigator.clipboard.writeText(resultado)
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-bold">Gerar descrição</h2>

      <div>
        <label className="block text-sm font-medium mb-1">
          Nome do produto
        </label>
        <input
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          placeholder="Ex: Fone Bluetooth XYZ"
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Características
        </label>
        <textarea
          value={caracteristicas}
          onChange={(e) => setCaracteristicas(e.target.value)}
          placeholder="Ex: bateria 30h, cancelamento de ruído, Ã  prova d'água"
          className="w-full border rounded-lg px-3 py-2 h-24"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tom</label>
        <select
          value={tom}
          onChange={(e) => setTom(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="profissional">Profissional</option>
          <option value="descontraido">Descontraído</option>
          <option value="luxo">Luxo / Premium</option>
          <option value="urgencia">Urgência / Vendas</option>
        </select>
      </div>

      <button
        onClick={gerar}
        disabled={loading || !produto}
        className="bg-black text-white px-6 py-2 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Gerando...' : 'Gerar descrição'}
      </button>

      {restantes !== null && (
        <p className="text-sm text-gray-500">
          Gerações restantes: {restantes}
        </p>
      )}

      {erro && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Resultado</h3>
            <button
              onClick={copiar}
              className="text-sm text-blue-600 hover:underline"
            >
              Copiar
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm">{resultado}</p>
        </div>
      )}
    </div>
  )
}