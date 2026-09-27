import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const MODELOS = [
  'models/gemini-flash-lite-latest',
  'models/gemini-2.5-flash',
  'models/gemini-2.0-flash',
]

export async function gerarDescricao(
  produto: string,
  caracteristicas: string,
  tom: string
): Promise<string> {
  const prompt = `Você é um copywriter especialista em e-commerce brasileiro.

Produto: ${produto}
Características: ${caracteristicas || 'não especificadas'}
Tom: ${tom}

Crie uma descrição de produto otimizada para SEO e conversão, com:
- Título chamativo (máx 60 caracteres)
- Parágrafo de abertura que conecta emocionalmente
- Lista de 4-5 benefícios (não apenas características)
- Chamada para ação final

Formato: texto puro, sem markdown.`

  let ultimoErro: any = null

  for (const nomeModelo of MODELOS) {
    try {
      console.log(`Tentando modelo: ${nomeModelo}`)

      const model = genAI.getGenerativeModel({ model: nomeModelo })
      const result = await model.generateContent(prompt)
      const response = await result.response
      const texto = response.text()

      console.log(`âœ… Sucesso com: ${nomeModelo}`)
      return texto
    } catch (err: any) {
      console.log(`âŒ Falhou ${nomeModelo}:`, err?.status, err?.statusText)
      ultimoErro = err
      continue
    }
  }

  throw new Error(
    `Todos os modelos falharam. Ãšltimo erro: ${ultimoErro?.status} ${ultimoErro?.statusText}`
  )
}
