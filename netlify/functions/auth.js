// Basic認証チェック用 Netlify Function
// 認証情報はNetlify環境変数で管理し、コードには記述しない

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  const { username, password } = JSON.parse(event.body || '{}')

  const validUser = process.env.AUTH_USERNAME
  const validPass = process.env.AUTH_PASSWORD

  if (!validUser || !validPass) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: '認証設定が未完了です' }) }
  }

  if (username === validUser && password === validPass) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
  }

  return { statusCode: 401, headers, body: JSON.stringify({ ok: false }) }
}
