import { sql } from './db'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'chave-secreta-descreveai-mudar-em-producao'
)

const COOKIE_NAME = 'descreveai_session'

// ============================================
// CRIAR USUÁRIO
// ============================================
export async function criarUsuario(email: string, senha: string) {
  // Verifica se já existe
  const existente = await sql`
    SELECT id FROM usuarios WHERE email = ${email}
  `

  if (existente.length > 0) {
    throw new Error('Email já cadastrado')
  }

  // Hash da senha
  const senhaHash = await bcrypt.hash(senha, 10)

  // Insere usuário
  const resultado = await sql`
    INSERT INTO usuarios (email, senha_hash)
    VALUES (${email}, ${senhaHash})
    RETURNING id, email
  `

  return resultado[0] as { id: string; email: string }
}

// ============================================
// FAZER LOGIN
// ============================================
export async function fazerLogin(email: string, senha: string) {
  const resultado = await sql`
    SELECT id, email, senha_hash FROM usuarios WHERE email = ${email}
  `

  if (resultado.length === 0) {
    throw new Error('Email ou senha inválidos')
  }

  const usuario = resultado[0] as {
    id: string
    email: string
    senha_hash: string
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash)

  if (!senhaCorreta) {
    throw new Error('Email ou senha inválidos')
  }

  // Cria JWT
  const token = await new SignJWT({ userId: usuario.id, email: usuario.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  // Salva cookie
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  })

  return { id: usuario.id, email: usuario.email }
}

// ============================================
// VERIFICAR SESSÃO
// ============================================
export async function pegarUsuarioLogado() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      id: payload.userId as string,
      email: payload.email as string,
    }
  } catch {
    return null
  }
}

// ============================================
// LOGOUT
// ============================================
export async function fazerLogout() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}