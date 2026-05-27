// Netlify Function: アンケートスプレッドシート → survey_responses 同期
// survey_columns に設定されたURLと列マッピングをもとに外部スプレッドシートからデータを取得して同期する

const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_KEY         = process.env.SUPABASE_SERVICE_ROLE_KEY
const SHEETS_BASE          = 'https://sheets.googleapis.com/v4/spreadsheets'

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  }
}

// ─── JWT / OAuth2 ─────────────────────────────────────────────────────────────

function base64url(data) {
  const b64 = Buffer.from(data).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getAccessToken(serviceAccountKey) {
  const key = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const header  = { alg: 'RS256', typ: 'JWT' }
  const toSign  = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const crypto  = await import('node:crypto')
  const sign    = crypto.createSign('RSA-SHA256')
  sign.update(toSign)
  const signature = sign.sign(key.private_key.replace(/\\n/g, '\n'), 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const jwt = `${toSign}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!tokenRes.ok) throw new Error(`トークン取得失敗: ${await tokenRes.text()}`)
  const { access_token } = await tokenRes.json()
  return access_token
}

// ─── Sheets API ───────────────────────────────────────────────────────────────

function extractSpreadsheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// ─── Netlify Function ─────────────────────────────────────────────────────────

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  try {
    const eventId = event.queryStringParameters?.event_id
    if (!eventId) throw new Error('event_id パラメータが必要です')

    // 1. Supabase から survey_columns を取得
    const colsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/survey_columns?event_id=eq.${encodeURIComponent(eventId)}&select=*&order=col_order`,
      { headers: supabaseHeaders() }
    )
    if (!colsRes.ok) throw new Error(`survey_columns 取得失敗: ${await colsRes.text()}`)
    const columns = await colsRes.json()
    if (columns.length === 0) throw new Error('このイベントのアンケート列設定がありません。「+ 列を追加」から設定してください。')

    // 2. アンケートスプレッドシートを読み取り（Google Sheets API）
    const spreadsheetUrl = columns[0].spreadsheet_url
    const surveySpreadsheetId = extractSpreadsheetId(spreadsheetUrl)
    if (!surveySpreadsheetId) throw new Error('スプレッドシートURLが正しくありません')

    const token = await getAccessToken(SERVICE_ACCOUNT_KEY)
    const surveyRes = await fetch(`${SHEETS_BASE}/${surveySpreadsheetId}/values/A:ZZ`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!surveyRes.ok) throw new Error(`アンケート読み取り失敗: ${await surveyRes.text()}`)
    const surveyData = await surveyRes.json()
    const [, ...surveyRows] = surveyData.values || []

    // 3. Supabase から既存の survey_responses を取得（重複チェック用）
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/survey_responses?event_id=eq.${encodeURIComponent(eventId)}&select=response_id,question_label&limit=50000`,
      { headers: supabaseHeaders() }
    )
    if (!existingRes.ok) throw new Error(`survey_responses 取得失敗: ${await existingRes.text()}`)
    const existing = await existingRes.json()
    const existingKeys = new Set(existing.map(r => `${r.response_id}__${r.question_label}`))

    // 4. 新規行を構築
    const newRows = []
    surveyRows.forEach((row, idx) => {
      const responseId = `row_${idx + 2}`
      columns.forEach(col => {
        const key = `${responseId}__${col.question_label}`
        if (existingKeys.has(key)) return
        const colIdx = Number(col.col_index) - 1
        const value  = (row[colIdx] || '').toString().trim()
        if (!value) return
        newRows.push({ id: generateId(), event_id: eventId, response_id: responseId, question_label: col.question_label, value })
      })
    })

    // 5. Supabase に一括挿入
    if (newRows.length > 0) {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/survey_responses`, {
        method: 'POST',
        headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
        body: JSON.stringify(newRows),
      })
      if (!insertRes.ok) throw new Error(`survey_responses 挿入失敗: ${await insertRes.text()}`)
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ synced: newRows.length, total: surveyRows.length }),
    }

  } catch (err) {
    console.error('sync-survey エラー:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
