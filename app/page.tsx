import Link from 'next/link'

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-8">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold">
          Descrições de produto que vendem, em 3 segundos
        </h1>
        <p className="text-lg text-gray-600">
          Cole o nome e as características. A IA gera descrição otimizada
          para SEO e conversão.
        </p>
        <Link
          href="/login"
          className="inline-block bg-black text-white px-8 py-3 rounded-lg"
        >
          Começar grátis
        </Link>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          ['⚡ Rápido', 'Descrição pronta em 3 segundos'],
          ['🎯 Otimizado', 'Feito para converter e ranquear'],
          ['💰 Barato', 'A partir de R$ 39/mês'],
        ].map(([t, d]) => (
          <div key={t} className="border rounded-lg p-4">
            <h3 className="font-semibold">{t}</h3>
            <p className="text-sm text-gray-600">{d}</p>
          </div>
        ))}
      </section>

      <section className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Planos</h2>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="border rounded-lg p-6">
            <h3 className="font-bold">Free</h3>
            <p className="text-3xl font-bold my-2">R$ 0</p>
            <p className="text-sm text-gray-600">5 gerações/mês</p>
          </div>
          <div className="border-2 border-black rounded-lg p-6">
            <h3 className="font-bold">Pro</h3>
            <p className="text-3xl font-bold my-2">R$ 39</p>
            <p className="text-sm text-gray-600">200 gerações/mês</p>
          </div>
        </div>
      </section>
    </main>
  )
}
