// Google Sheets API のフロントエンドラッパー
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

// シートの全データを取得（1行目はヘッダー）
// 戻り値: { headers: string[], rows: object[] }
export async function getSheet(sheetName) {
  const data = await request('GET', { sheet: sheetName })
  if (!data.values || data.values.length === 0) {
    return { headers: [], rows: [] }
  }
  const [headers, ...rawRows] = data.values
  const rows = rawRows.map((row, idx) => {
    const obj = { _rowIndex: idx + 2 } // スプレッドシートの行番号（1ヘッダー + 1-indexed）
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? ''
    })
    return obj
  })
  return { headers, rows }
}

// 末尾に新規行を追加
// values: object（シートのヘッダーをキーとする）または配列
export async function appendRow(sheetName, values) {
  return request('POST', { action: 'append', sheet: sheetName, values })
}

// 指定行を更新
// rowIndex: スプレッドシートの行番号（2始まり）
export async function updateRow(sheetName, rowIndex, values) {
  return request('POST', { action: 'update', sheet: sheetName, rowIndex, values })
}

// 指定行を削除
export async function deleteRow(sheetName, rowIndex) {
  return request('POST', { action: 'delete', sheet: sheetName, rowIndex })
}

// 便利関数：idで行を検索して更新
export async function updateById(sheetName, id, values) {
  const { headers, rows } = await getSheet(sheetName)
  const row = rows.find(r => r.id === id)
  if (!row) throw new Error(`ID ${id} が ${sheetName} に見つかりません`)
  const rowValues = headers.map(h => values[h] ?? row[h] ?? '')
  return updateRow(sheetName, row._rowIndex, rowValues)
}

// 便利関数：idで行を削除
export async function deleteById(sheetName, id) {
  const { rows } = await getSheet(sheetName)
  const row = rows.find(r => r.id === id)
  if (!row) throw new Error(`ID ${id} が ${sheetName} に見つかりません`)
  return deleteRow(sheetName, row._rowIndex)
}

// UUIDライクなID生成
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
