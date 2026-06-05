// Netlify Function: Supabase プロキシ
// service_role key をサーバーサイドで保護する

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function supabaseHeaders() {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  }
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '環境変数 SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません' }),
    }
  }

  try {
    // ── GET: テーブルデータ取得 ──
    if (event.httpMethod === 'GET') {
      const sheet = event.queryStringParameters?.sheet
      if (!sheet) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sheet パラメータが必要です' }) }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/${sheet}?select=*&limit=10000&order=id`, {
        headers: { ...supabaseHeaders(), 'Prefer': 'count=none' },
      })
      if (!res.ok) throw new Error(`Supabase GET 失敗: ${await res.text()}`)
      const rows = await res.json()
      return { statusCode: 200, headers, body: JSON.stringify({ rows }) }
    }

    // ── POST: 追加・更新・削除 ──
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { action, sheet, values, id } = body

      if (!sheet) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sheet が必要です' }) }

      // 追加
      if (action === 'append') {
        if (!values) return { statusCode: 400, headers, body: JSON.stringify({ error: 'values が必要です' }) }
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${sheet}`, {
          method: 'POST',
          headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(values),
        })
        if (!res.ok) throw new Error(`Supabase INSERT 失敗: ${await res.text()}`)
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
      }

      // 更新
      if (action === 'update') {
        if (!id || !values) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id と values が必要です' }) }
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${sheet}?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(values),
        })
        if (!res.ok) throw new Error(`Supabase UPDATE 失敗: ${await res.text()}`)
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
      }

      // 削除（IDで1件）
      if (action === 'delete') {
        if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id が必要です' }) }
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${sheet}?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
        })
        if (!res.ok) throw new Error(`Supabase DELETE 失敗: ${await res.text()}`)
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
      }

      // 条件一括削除（deleteByFilter）
      if (action === 'deleteByFilter') {
        const filter = body.filter
        if (!filter || Object.keys(filter).length === 0)
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'filter が必要です' }) }
        const qs = Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&')
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${sheet}?${qs}`, {
          method: 'DELETE',
          headers: { ...supabaseHeaders(), 'Prefer': 'return=minimal' },
        })
        if (!res.ok) throw new Error(`Supabase DELETE(filter) 失敗: ${await res.text()}`)
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) }
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: `不明な action: ${action}` }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) }

  } catch (err) {
    console.error('Sheets Function エラー:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) }
  }
}
