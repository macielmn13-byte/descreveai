import { NextResponse } from 'next/server'
import { fazerLogout } from '@/lib/auth'

export async function POST() {
  await fazerLogout()
  return NextResponse.json({ ok: true })
}