// Netlify Function: アンケートスプレッドシート → survey_responses シート 同期
// survey_columns に設定されたURLと列マッピングをもとに、外部スプレッドシートからデータを取得して同期する

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

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
  const header = { alg: 'RS256', typ: 'JWT' }
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const crypto = await import('node:crypto')
  const privateKey = key.private_key.replace(/\\n/g, '\n')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(toSign)
  const signature = sign.sign(privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
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

// ─── Sheets API ヘルパー ──────────────────────────────────────────────────────

async function sheetsGet(token, spreadsheetId, sheetName) {
  const range = sheetName ? encodeURIComponent(sheetName) : 'A:ZZ'
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`読み取り失敗 (${sheetName || spreadsheetId}): ${await res.text()}`)
  return res.json()
}

async function sheetsAppendBatch(token, spreadsheetId, sheetName, rows) {
  if (rows.length === 0) return
  const range = encodeURIComponent(sheetName)
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  })
  if (!res.ok) throw new Error(`書き込み失敗: ${await res.text()}`)
  return res.json()
}

function extractSpreadsheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function toMap(values) {
  if (!values || values.length < 2) return []
  const [header, ...rows] = values
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').toString()])))
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
    if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_KEY) throw new Error('環境変数が設定されていません')

    const token = await getAccessToken(SERVICE_ACCOUNT_KEY)

    // 1. survey_columns からこのイベントの設定を取得
    const columnsData = await sheetsGet(token, SPREADSHEET_ID, 'survey_columns')
    const columns = toMap(columnsData.values).filter(c => c.event_id === eventId)
    if (columns.length === 0) throw new Error('このイベントのアンケート列設定がありません。「+ 列を追加」から設定してください。')

    // 2. アンケートスプレッドシートを読み取り
    const spreadsheetUrl = columns[0].spreadsheet_url
    const surveySpreadsheetId = extractSpreadsheetId(spreadsheetUrl)
    if (!surveySpreadsheetId) throw new Error('スプレッドシートURLが正しくありません')

    const surveyData = await sheetsGet(token, surveySpreadsheetId)
    const [, ...surveyRows] = surveyData.values || []  // 1行目ヘッダーをスキップ

    // 3. 既存の survey_responses を取得（重複チェック用）
    const existingData = await sheetsGet(token, SPREADSHEET_ID, 'survey_responses')
    const existingRows = toMap(existingData.values)
    const existingKeys = new Set(
      existingRows.filter(r => r.event_id === eventId).map(r => `${r.response_id}__${r.question_label}`)
    )

    // 4. 新規行を構築
    const newRows = []
    surveyRows.forEach((row, idx) => {
      const responseId = `row_${idx + 2}`  // 2行目から（1行目=ヘッダー）
      columns.forEach(col => {
        const key = `${responseId}__${col.question_label}`
        if (existingKeys.has(key)) return  // 既に同期済み
        const colIdx = Number(col.col_index) - 1  // 0-indexed
        const value = (row[colIdx] || '').toString().trim()
        if (!value) return  // 空値はスキップ
        newRows.push([generateId(), eventId, responseId, col.question_label, value])
      })
    })

    // 5. 一括追加
    await sheetsAppendBatch(token, SPREADSHEET_ID, 'survey_responses', newRows)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        synced: newRows.length,
        total: surveyRows.length,
      }),
    }

  } catch (err) {
    console.error('sync-survey エラー:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
