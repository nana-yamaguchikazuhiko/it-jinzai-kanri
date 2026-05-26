// Supabase API のフロントエンドラッパー
// 実際の呼び出しは netlify/functions/sheets.js で行う

const API_BASE = '/.netlify/functions/sheets'

async function request(method, params) {
  let url = API_BASE
  let options = { method, headers: { 'Content-Type': 'application/json' } }

  if (method === 'GET') {
    const qs = new URLSearchParams(params).toString()
    url = `${API_BASE}?${qs}`
  } else {
    options.body = JSON.stringify(params)
  }

  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sheets API エラー [${res.status}]: ${err}`)
  }
  return res.json()
}

// テーブルの全データを取得
// 戻り値: { headers: string[], rows: object[] }
export async function getSheet(sheetName) {
  const data = await request('GET', { sheet: sheetName })
  const rows = data.rows || []
  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = Object.keys(rows[0])
  return { headers, rows }
}

// 新規行を追加
// values: オブジェクト（列名をキーとする）
export async function appendRow(sheetName, values) {
  return request('POST', { action: 'append', sheet: sheetName, values })
}

// idで行を更新
export async function updateById(sheetName, id, values) {
  return request('POST', { action: 'update', sheet: sheetName, id, values })
}

// idで行を削除
export async function deleteById(sheetName, id) {
  return request('POST', { action: 'delete', sheet: sheetName, id })
}

// 後方互換（内部的にupdateByIdと同じ）
export async function updateRow(sheetName, id, values) {
  return updateById(sheetName, id, values)
}

export async function deleteRow(sheetName, id) {
  return deleteById(sheetName, id)
}

// UUIDライクなID生成
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
