// セッショントークンの発行・検証（共有ヘルパー）
// ファイル名が _ で始まるためNetlify Functionsのエンドポイントとしては公開されない

import crypto from 'node:crypto'

const SECRET = process.env.SESSION_SECRET
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000 // 12時間

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64uDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(payloadB64) {
  return b64u(crypto.createHmac('sha256', SECRET).update(payloadB64).digest())
}

export function issueToken(username, ttlMs = DEFAULT_TTL_MS) {
  if (!SECRET) throw new Error('SESSION_SECRET が未設定です')
  const payloadB64 = b64u(JSON.stringify({ u: username, exp: Date.now() + ttlMs }))
  return `${payloadB64}.${sign(payloadB64)}`
}

export function verifyToken(token) {
  if (!SECRET || typeof token !== 'string') return false
  const [payloadB64, sig] = token.split('.')
  if (!payloadB64 || !sig) return false

  const expectedSig = sign(payloadB64)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false

  let payload
  try {
    payload = JSON.parse(b64uDecode(payloadB64).toString('utf8'))
  } catch {
    return false
  }
  return typeof payload.exp === 'number' && Date.now() <= payload.exp
}

// event からAuthorizationヘッダーを取り出して検証する
// ローカル開発（netlify dev）では、フロントエンドのログイン画面スキップに合わせて認証を免除する
export function requireAuth(event) {
  if (process.env.NETLIFY_DEV === 'true') return true
  const header = event.headers?.authorization || event.headers?.Authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return verifyToken(token)
}

export function unauthorizedResponse(headers) {
  return { statusCode: 401, headers, body: JSON.stringify({ error: '認証が必要です' }) }
}
