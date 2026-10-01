'use client'

export default function UpgradeButton({ plano }: { plano: string }) {
  const linkPagamento = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK

  if (!linkPagamento) {
    return null
  }

  // Se já é Pro, mostra badge "PRO"
  if (plano === 'pro') {
    return (
      <span className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white text-xs font-bold px-3 py-1 rounded-full">
        ⭐ PRO
      </span>
    )
  }

  // Se é Free, mostra botão de upgrade
  return (
    <a
      href={linkPagamento}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition"
    >
      ⚡ Fazer upgrade — R$ 39/mês
    </a>
  )
}