// Netlify Function: Google Sheets API プロキシ
// サービスアカウントの秘密鍵をサーバーサイドで保護する

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

// ─── JWT / OAuth2 ────────────────────────────────────────────────────────────

// Base64url エンコード
function base64url(data) {
  const b64 = Buffer.from(data).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// サービスアカウントのJWTでGoogleアクセストークンを取得
async function getAccessToken(serviceAccountKey) {
  const key = typeof serviceAccountKey === 'string'
    ? JSON.parse(serviceAccountKey)
    : serviceAccountKey

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const header = { alg: 'RS256', typ: 'JWT' }
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`

  // Node.js crypto でRS256署名
  const crypto = await import('node:crypto')
  const privateKey = key.private_key.replace(/\\n/g, '\n')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(toSign)
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${toSign}.${signature}`

  // トークンエンドポイントへ
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`トークン取得失敗: ${err}`)
  }
  const { access_token } = await tokenRes.json()
  return access_token
}

// ─── Sheets API ヘルパー ──────────────────────────────────────────────────────

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// シートデータを取得
async function sheetsGet(token, sheetName) {
  const range = encodeURIComponent(sheetName)
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`sheets.get 失敗: ${await res.text()}`)
  return res.json()
}

// 末尾に行を追加
async function sheetsAppend(token, sheetName, values) {
  const range = encodeURIComponent(sheetName)
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  })
  if (!res.ok) throw new Error(`sheets.append 失敗: ${await res.text()}`)
  return res.json()
}

// 指定範囲を更新
async function sheetsUpdate(token, sheetName, rowIndex, values) {
  // 行全体を上書き（列Aから始まる）
  const colEnd = columnLetter(values.length)
  const range = encodeURIComponent(`${sheetName}!A${rowIndex}:${colEnd}${rowIndex}`)
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  })
  if (!res.ok) throw new Error(`sheets.update 失敗: ${await res.text()}`)
  return res.json()
}

// 指定行を削除（batchUpdate）
async function sheetsDeleteRow(token, rowIndex, sheetId) {
  const url = `${SHEETS_BASE}/${SPREADSHEET_ID}:batchUpdate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1, // 0-indexed
            endIndex: rowIndex,
          },
        },
      }],
    }),
  })
  if (!res.ok) throw new Error(`sheets.delete 失敗: ${await res.text()}`)
  return res.json()
}

// 列番号をABC表記に変換（1→A, 26→Z, 27→AA）
function columnLetter(n) {
  let s = ''
  while (n > 0) {
    n--
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26)
  }
  return s
}

// シート名→シートIDのキャッシュ
let sheetIdCache = null
async function getSheetId(token, sheetName) {
  if (!sheetIdCache) {
    const res = await fetch(`${SHEETS_BASE}/${SPREADSHEET_ID}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    sheetIdCache = {}
    for (const s of data.sheets || []) {
      sheetIdCache[s.properties.title] = s.properties.sheetId
    }
  }
  if (sheetIdCache[sheetName] === undefined) {
    throw new Error(`シート "${sheetName}" が見つかりません`)
  }
  return sheetIdCache[sheetName]
}

// ─── Netlify Function ─────────────────────────────────────────────────────────

export const handler = async (event) => {
  // CORS ヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '環境変数 GOOGLE_SPREADSHEET_ID または GOOGLE_SERVICE_ACCOUNT_KEY が設定されていません' }),
    }
  }

  try {
    const token = await getAccessToken(SERVICE_ACCOUNT_KEY)

    // ── GET: シートデータ取得 ──
    if (event.httpMethod === 'GET') {
      const sheetName = event.queryStringParameters?.sheet
      if (!sheetName) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sheet パラメータが必要です' }) }
      const data = await sheetsGet(token, sheetName)
      return { statusCode: 200, headers, body: JSON.stringify(data) }
    }

    // ── POST: 追加・更新・削除 ──
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { action, sheet, values, rowIndex } = body

      if (!sheet) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sheet が必要です' }) }

      if (action === 'append') {
        if (!values) return { statusCode: 400, headers, body: JSON.stringify({ error: 'values が必要です' }) }
        const result = await sheetsAppend(token, sheet, values)
        return { statusCode: 200, headers, body: JSON.stringify(result) }
      }

      if (action === 'update') {
        if (!rowIndex || !values) return { statusCode: 400, headers, body: JSON.stringify({ error: 'rowIndex と values が必要です' }) }
        const result = await sheetsUpdate(token, sheet, rowIndex, values)
        return { statusCode: 200, headers, body: JSON.stringify(result) }
      }

      if (action === 'delete') {
        if (!rowIndex) return { statusCode: 400, headers, body: JSON.stringify({ error: 'rowIndex が必要です' }) }
        const sheetId = await getSheetId(token, sheet)
        const result = await sheetsDeleteRow(token, rowIndex, sheetId)
        // キャッシュをリセット（行削除後はシートID変わらないがindexがずれる）
        sheetIdCache = null
        return { statusCode: 200, headers, body: JSON.stringify(result) }
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: `不明な action: ${action}` }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) }

  } catch (err) {
    console.error('Sheets Function エラー:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
