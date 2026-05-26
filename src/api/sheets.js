// Supabase API のフロントエンドラッパー
// 実際の呼び出しは netlify/functions/sheets.js で行う

const API_BASE = '/.netlify/functions/sheets'

// ── クライアントキャッシュ（ページ移動を高速化）──
// データはブラウザのメモリにのみ保持。通信・認証の仕組みは変わらない。
const cache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5分

function invalidateCache(sheetName) {
  cache.delete(sheetName)
}

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

// テーブルの全データを取得（キャッシュあり）
// 戻り値: { headers: string[], rows: object[] }
export async function getSheet(sheetName, { forceRefresh = false } = {}) {
  const now = Date.now()
  const cached = cache.get(sheetName)
  if (!forceRefresh && cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.data
  }
  const data = await request('GET', { sheet: sheetName })
  const rows = data.rows || []
  const result = { headers: rows.length > 0 ? Object.keys(rows[0]) : [], rows }
  cache.set(sheetName, { data: result, fetchedAt: now })
  return result
}

// 新規行を追加（書き込み後にキャッシュを無効化）
// values: オブジェクト（列名をキーとする）
export async function appendRow(sheetName, values) {
  const result = await request('POST', { action: 'append', sheet: sheetName, values })
  invalidateCache(sheetName)
  return result
}

// idで行を更新（書き込み後にキャッシュを無効化）
export async function updateById(sheetName, id, values) {
  const result = await request('POST', { action: 'update', sheet: sheetName, id, values })
  invalidateCache(sheetName)
  return result
}

// idで行を削除（書き込み後にキャッシュを無効化）
export async function deleteById(sheetName, id) {
  const result = await request('POST', { action: 'delete', sheet: sheetName, id })
  invalidateCache(sheetName)
  return result
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
