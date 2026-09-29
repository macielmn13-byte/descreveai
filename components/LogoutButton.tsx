'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function logout() {
    setLoading(true)

    try {
      await fetch('/api/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="text-sm text-gray-600 hover:text-red-600 underline disabled:opacity-50"
    >
      {loading ? 'Saindo...' : 'Sair'}
    </button>
  )
}