// Netlify Function: 企業申込スプレッドシート → 企業データ読み込み
// ヘッダー行で列を自動検出し、新規／前回（変更なし）の動線を自動判定して返す

const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
const SHEETS_BASE          = 'https://sheets.googleapis.com/v4/spreadsheets'

function base64url(data) {
  const b64 = Buffer.from(data).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function getAccessToken(serviceAccountKey) {
  const key  = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey
  const now  = Math.floor(Date.now() / 1000)
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

function extractSpreadsheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : null
}

function getVal(row, idx) {
  if (idx < 0) return ''
  return ((row[idx] || '')).toString().trim()
}

// ヘッダー行から指定ラベルが何列目か（0始まり）を返す。occurrence=2で2回目の出現を探す
function findColIdx(headers, label, occurrence = 1) {
  let count = 0
  for (let i = 0; i < headers.length; i++) {
    if ((headers[i] || '').trim() === label) {
      count++
      if (count === occurrence) return i
    }
  }
  return -1
}

// 企業データのフィールドセットを列インデックスで定義
function buildFieldSet(headers, webOccurrence) {
  const web  = findColIdx(headers, 'コーポレートサイトURL', webOccurrence)
  if (web < 0) return null
  // URL列の次から順番に並んでいることを前提にしつつ、ヘッダーで確認補正
  const after = (label) => {
    for (let i = web + 1; i < Math.min(web + 15, headers.length); i++) {
      if ((headers[i] || '').trim() === label) return i
    }
    return -1
  }
  return {
    website:     web,
    established: after('設立年'),
    address:     after('本社所在地'),
    location:    after('勤務地'),
    business:    after('業務内容'),
    employees:   after('従業員数'),
    age:         after('平均年齢'),
    gender:      after('男女比'),
    paidLeave:   after('平均有給取得率'),
    overtime:    after('平均残業時間'),
    holidays:    after('年間休日数'),
    remote:      after('リモート勤務について'),
    message:     after('学生へのメッセージ'),
  }
}

function extractFromSet(row, set) {
  if (!set) return null
  const web = getVal(row, set.website)
  if (!web) return null
  return {
    website:     web,
    established: getVal(row, set.established),
    address:     getVal(row, set.address),
    location:    getVal(row, set.location),
    business:    getVal(row, set.business),
    employees:   getVal(row, set.employees),
    age:         getVal(row, set.age),
    gender:      getVal(row, set.gender),
    paidLeave:   getVal(row, set.paidLeave),
    overtime:    getVal(row, set.overtime),
    holidays:    getVal(row, set.holidays),
    remote:      getVal(row, set.remote),
    message:     getVal(row, set.message),
  }
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  try {
    const spreadsheetUrl = event.queryStringParameters?.spreadsheet_url
    if (!spreadsheetUrl) throw new Error('spreadsheet_url パラメータが必要です')

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl)
    if (!spreadsheetId) throw new Error('スプレッドシートIDを取得できませんでした')

    const token  = await getAccessToken(SERVICE_ACCOUNT_KEY)
    const res    = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/A:AM`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`スプレッドシート読み取り失敗: ${await res.text()}`)

    const data = await res.json()
    const allRows = data.values || []
    if (allRows.length < 2) return { statusCode: 200, headers, body: JSON.stringify({ companies: [] }) }

    const headerRow = allRows[0]
    const dataRows  = allRows.slice(1)

    // 企業名の列
    const colName = findColIdx(headerRow, '貴社名')

    // Set1（新規・変更あり）= コーポレートサイトURL の1回目の出現以降
    const set1 = buildFieldSet(headerRow, 1)
    // Set2（前回・変更なし）= コーポレートサイトURL の2回目の出現以降
    const set2 = buildFieldSet(headerRow, 2)

    const companies = []

    for (const row of dataRows) {
      const name = getVal(row, colName)
      if (!name) continue

      // Set1 優先（新規 or 変更あり）。URLがあればSet1を使う
      let info = extractFromSet(row, set1)

      // Set1にデータなし → Set2（変更なし）を試みる
      if (!info) info = extractFromSet(row, set2)

      if (!info) continue  // データなし（変更なし＆前回データ未入力等）

      companies.push({ name, ...info })
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ companies, total: dataRows.length }),
    }

  } catch (err) {
    console.error('read-company-sheet エラー:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
