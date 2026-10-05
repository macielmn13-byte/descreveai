'use client'

import { useState } from 'react'

type Geracao = {
  id: string
  produto: string
  resultado: string
  criado_em: string
}

export default function HistoricoGeracoes({
  geracoes,
}: {
  geracoes: Geracao[]
}) {
  const [aberta, setAberta] = useState<string | null>(null)

  if (geracoes.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Você ainda não gerou nenhuma descrição.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {geracoes.map((g) => (
        <div key={g.id} className="border rounded-lg">
          <button
            onClick={() => setAberta(aberta === g.id ? null : g.id)}
            className="w-full text-left p-3 hover:bg-gray-50 transition flex justify-between items-center"
          >
            <span className="font-medium">{g.produto}</span>
            <span className="text-xs text-gray-500">
              {new Date(g.criado_em).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </button>

          {aberta === g.id && (
            <div className="border-t p-4 bg-gray-50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Resultado</span>
                <button
                  onClick={() => navigator.clipboard.writeText(g.resultado)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Copiar
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{g.resultado}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}