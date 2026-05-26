import { useState, useEffect, useCallback } from 'react'
import { getSheet } from '../api/sheets'

// シートデータをフェッチするカスタムフック
// usage: const { rows, headers, loading, error, reload } = useSheets('events')
export function useSheets(sheetName) {
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (forceRefresh = false) => {
    if (!sheetName) return
    setLoading(true)
    setError(null)
    try {
      const result = await getSheet(sheetName, { forceRefresh })
      setHeaders(result.headers)
      setRows(result.rows)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [sheetName])

  useEffect(() => {
    load()
  }, [load])

  // reload() はキャッシュをスキップして最新データを取得
  return { rows, headers, loading, error, reload: () => load(true) }
}
