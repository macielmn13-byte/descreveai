import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
        <h1 className="text-5xl font-bold leading-tight">
          Descrições de produto que vendem, em 3 segundos
        </h1>
        <p className="text-xl text-gray-600">
          Cole o nome e as características. A IA gera descrição otimizada
          para SEO e conversão.
        </p>
        <Link
          href="/login"
          className="inline-block bg-black text-white px-10 py-4 rounded-lg text-lg font-medium hover:bg-gray-800 transition"
        >
          Começar grátis →
        </Link>
        <p className="text-sm text-gray-500">
          Sem cartão de crédito · 5 gerações grátis por mês
        </p>
      </section>

      {/* BENEFÍCIOS */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        {[
          ['⚡', 'Rápido', 'Descrição pronta em 3 segundos. Sem perder tempo pensando no texto.'],
          ['🎯', 'Otimizado', 'Feito para converter e ranquear no Google. Copy profissional.'],
          ['💰', 'Barato', 'A partir de R$ 39/mês. Menos que uma hora de copywriter.'],
        ].map(([emoji, titulo, desc]) => (
          <div key={titulo} className="border rounded-xl p-6 hover:shadow-lg transition">
            <div className="text-3xl mb-3">{emoji}</div>
            <h3 className="font-bold text-lg mb-2">{titulo}</h3>
            <p className="text-gray-600 text-sm">{desc}</p>
          </div>
        ))}
      </section>

      {/* COMO FUNCIONA */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            Como funciona
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              ['1', 'Cole os dados', 'Nome do produto + características principais.'],
              ['2', 'IA gera', 'O Gemini cria uma descrição otimizada em segundos.'],
              ['3', 'Copie e use', 'Cola no seu e-commerce, Shopify, Mercado Livre.'],
            ].map(([num, titulo, desc]) => (
              <div key={num} className="text-center">
                <div className="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {num}
                </div>
                <h3 className="font-bold text-lg mb-2">{titulo}</h3>
                <p className="text-gray-600 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Planos</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border rounded-xl p-8">
            <h3 className="font-bold text-xl mb-2">Free</h3>
            <p className="text-4xl font-bold mb-2">R$ 0</p>
            <p className="text-gray-600 text-sm mb-6">5 gerações/mês</p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Geração de descrições com IA</li>
              <li>✓ 4 tons diferentes</li>
              <li>✓ Histórico salvo</li>
            </ul>
          </div>
          <div className="border-2 border-black rounded-xl p-8 relative">
            <span className="absolute -top-3 left-8 bg-black text-white text-xs px-3 py-1 rounded-full">
              Mais popular
            </span>
            <h3 className="font-bold text-xl mb-2">Pro</h3>
            <p className="text-4xl font-bold mb-2">R$ 39</p>
            <p className="text-gray-600 text-sm mb-6">200 gerações/mês</p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Tudo do Free</li>
              <li>✓ 200 gerações/mês</li>
              <li>✓ Suporte prioritário</li>
              <li>✓ Exportar histórico</li>
            </ul>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            Quem usa, aprova
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              ['Ana Silva', 'Lojista', 'Economizei 10 horas por semana. A IA gera tudo em segundos.'],
              ['Carlos Souza', 'Freelancer', 'Minhas entregas ficaram mais rápidas e o cliente adorou.'],
              ['Juliana Costa', 'E-commerce', 'Aumentei minhas vendas em 40% com descrições melhores.'],
            ].map(([nome, cargo, texto]) => (
              <div key={nome} className="bg-white border rounded-xl p-6">
                <p className="text-gray-700 mb-4 italic">"{texto}"</p>
                <div>
                  <p className="font-bold">{nome}</p>
                  <p className="text-sm text-gray-500">{cargo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Perguntas frequentes
        </h2>
        <div className="space-y-4">
          {[
            ['Como funciona a IA?', 'Usamos o Google Gemini para gerar descrições otimizadas baseadas no nome e características do seu produto.'],
            ['Preciso saber programar?', 'Não. Você só preenche o formulário e copia a descrição gerada.'],
            ['Posso cancelar quando quiser?', 'Sim. Sem multa, sem burocracia. Cancele com 1 clique.'],
            ['Funciona para qualquer produto?', 'Sim. Físico, digital, serviço ou curso. A IA se adapta ao contexto.'],
            ['Quantas gerações por mês?', 'Free: 5 gerações. Pro: 200 gerações. Planos maiores sob consulta.'],
          ].map(([pergunta, resposta]) => (
            <details
              key={pergunta}
              className="border rounded-lg p-4 cursor-pointer group"
            >
              <summary className="font-medium list-none flex justify-between items-center">
                {pergunta}
                <span className="text-gray-400 group-open:rotate-180 transition">
                  ▼
                </span>
              </summary>
              <p className="text-gray-600 text-sm mt-3">{resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-black text-white py-20 text-center">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
          <h2 className="text-3xl font-bold">
            Pronto para vender mais?
          </h2>
          <p className="text-gray-300">
            Comece grátis agora. Sem cartão de crédito.
          </p>
          <Link
            href="/login"
            className="inline-block bg-white text-black px-10 py-4 rounded-lg text-lg font-medium hover:bg-gray-100 transition"
          >
            Começar grátis →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 text-center text-sm text-gray-500">
        <p>© 2026 DescreveAí · Todos os direitos reservados</p>
        <p className="mt-2">
          Feito com ❤️ no Brasil
        </p>
      </footer>
    </main>
  )
}