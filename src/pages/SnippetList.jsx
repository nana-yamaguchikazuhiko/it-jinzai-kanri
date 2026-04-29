import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, deleteById, generateId } from '../api/sheets'

const CATEGORIES = ['GAS', 'JavaScript', 'SQL', 'その他']

const EMPTY_FORM = { title: '', description: '', category: 'GAS', code: '' }

export default function SnippetList() {
  const { rows: snippets, loading, error, reload } = useSheets('snippets')

  const [filterCat, setFilterCat]     = useState('')
  const [searchText, setSearchText]   = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [copiedId, setCopiedId]       = useState(null)

  const filtered = useMemo(() => {
    return [...snippets]
      .filter(s => !filterCat || s.category === filterCat)
      .filter(s => !searchText ||
        s.title?.includes(searchText) ||
        s.description?.includes(searchText) ||
        s.code?.includes(searchText)
      )
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  }, [snippets, filterCat, searchText])

  const handleCopy = (snippet) => {
    navigator.clipboard.writeText(snippet.code || '').then(() => {
      setCopiedId(snippet.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const startAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const startEdit = (snippet) => {
    setEditingId(snippet.id)
    setForm({ title: snippet.title || '', description: snippet.description || '', category: snippet.category || 'GAS', code: snippet.code || '' })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { alert('タイトルを入力してください'); return }
    if (!form.code.trim())  { alert('コードを入力してください'); return }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      if (editingId) {
        const target = snippets.find(s => s.id === editingId)
        await updateById('snippets', editingId, { ...target, ...form, updated_at: now })
      } else {
        await appendRow('snippets', [generateId(), form.title, form.description, form.category, form.code, now, now])
      }
      await reload()
      handleCancel()
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (snippet) => {
    if (!confirm(`「${snippet.title}」を削除しますか？`)) return
    try { await deleteById('snippets', snippet.id); reload() }
    catch (e) { alert('削除失敗: ' + e.message) }
  }

  const C = { primary: '#06b6d4', text: '#1e2d3d', muted: '#94a3b8', secondary: '#64748b', border: '#e8edf2' }

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">データ取得エラー: {error}</div>
    </div>
  )

  return (
    <div className="p-6">

      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>スニペット</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reload}
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.secondary, cursor: 'pointer' }}>
            ↻ 更新
          </button>
          <button onClick={startAdd}
            style={{ fontSize: 12, padding: '6px 16px', borderRadius: 6, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            ＋ 追加
          </button>
        </div>
      </div>

      {/* 追加・編集フォーム */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '24px 28px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 18 }}>
            {editingId ? 'スニペットを編集' : '新しいスニペットを追加'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">タイトル *</label>
              <input type="text" className="form-input" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="例: Gmailラベル取得" />
            </div>
            <div>
              <label className="form-label">説明</label>
              <input type="text" className="form-input" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="簡単な説明..." />
            </div>
            <div>
              <label className="form-label">カテゴリ</label>
              <select className="form-select" value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">コード *</label>
            <textarea
              className="form-input"
              rows={12}
              style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 12, lineHeight: 1.7, resize: 'vertical', background: '#0f1c2e', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8 }}
              value={form.code}
              onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
              placeholder="コードをここに貼り付け..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '8px 24px', borderRadius: 6, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={handleCancel}
              style={{ padding: '8px 16px', borderRadius: 6, background: '#f1f5f9', color: C.secondary, border: 'none', cursor: 'pointer', fontSize: 13 }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* フィルター・検索 */}
      <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="タイトル・コードで検索..."
          className="form-input" style={{ maxWidth: 260 }}
          value={searchText} onChange={e => setSearchText(e.target.value)} />
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
              style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600,
                background: filterCat === cat ? C.primary : '#f1f5f9',
                color: filterCat === cat ? '#fff' : C.secondary,
                border: 'none',
              }}>
              {cat}
            </button>
          ))}
        </div>
        {(filterCat || searchText) && (
          <button onClick={() => { setFilterCat(''); setSearchText('') }}
            style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            クリア
          </button>
        )}
        <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{filtered.length}件</span>
      </div>

      {/* スニペット一覧 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted, fontSize: 13 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted, fontSize: 13 }}>
          {snippets.length === 0 ? '「＋ 追加」からスニペットを登録してください' : '条件に一致するスニペットがありません'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(snippet => (
            <div key={snippet.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

              {/* カードヘッダー */}
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#e0f7fa', color: '#0891b2', fontWeight: 600, flexShrink: 0 }}>
                  {snippet.category || 'その他'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snippet.title}</div>
                  {snippet.description && (
                    <div style={{ fontSize: 12, color: C.secondary, marginTop: 2 }}>{snippet.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => handleCopy(snippet)}
                    style={{
                      fontSize: 12, padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                      background: copiedId === snippet.id ? '#dcfce7' : '#f1f5f9',
                      color: copiedId === snippet.id ? '#16a34a' : C.secondary,
                      border: 'none', transition: 'background 0.2s',
                    }}>
                    {copiedId === snippet.id ? '✓ コピー済み' : 'コピー'}
                  </button>
                  <button onClick={() => startEdit(snippet)}
                    style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                    編集
                  </button>
                  <button onClick={() => handleDelete(snippet)}
                    style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                    削除
                  </button>
                </div>
              </div>

              {/* コード */}
              <div style={{ background: '#0f1c2e', padding: '16px 20px', overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace', fontSize: 12, lineHeight: 1.7, color: '#e2e8f0', whiteSpace: 'pre' }}>
                  {snippet.code}
                </pre>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
