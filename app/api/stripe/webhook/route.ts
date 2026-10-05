import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sql } from '@/lib/db'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as any,
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Sem assinatura' }, { status: 400 })
    }

    // Valida que veio do Stripe
    let evento: Stripe.Event
    try {
      evento = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Erro de validação:', err.message)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
    }

    console.log('Evento recebido:', evento.type)

    // Processa o evento
    switch (evento.type) {
      case 'checkout.session.completed': {
        const session = evento.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email

        if (!email) {
          console.error('Sem email no evento')
          break
        }

        console.log('Cliente pagou:', email)

        // Extrai customer_id do Stripe (pra usar no cancelamento)
        const customerId = session.customer as string

        // Atualiza o usuário pra PRO + salva customer_id
        await sql`
          UPDATE perfis
          SET plano = 'pro',
              limite_geracoes = 200,
              stripe_customer_id = ${customerId}
          WHERE user_id IN (
            SELECT id FROM usuarios WHERE email = ${email}
          )
        `

        console.log('Usuário atualizado pra PRO:', email)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = evento.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        console.log('Assinatura cancelada:', customerId)

        // Volta o usuário pra free
        await sql`
          UPDATE perfis
          SET plano = 'free', limite_geracoes = 5
          WHERE stripe_customer_id = ${customerId}
        `

        break
      }

      default:
        console.log('Evento ignorado:', evento.type)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Erro no webhook:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}