import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, deleteById, generateId } from '../api/sheets'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'

const CATEGORIES = ['GAS', 'JavaScript', 'SQL', 'その他']
const EMPTY_FORM = { title: '', description: '', category: 'GAS', code: '' }

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }
const inputStyle = {
  width: '100%', fontSize: 13, fontFamily: 'inherit', color: T.ink,
  border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px',
  background: T.surface, outline: 'none',
}

export default function SnippetList() {
  const { rows: snippets, loading, error, reload } = useSheets('snippets')

  const [filterCat,   setFilterCat  ] = useState('')
  const [searchText,  setSearchText ] = useState('')
  const [showForm,    setShowForm   ] = useState(false)
  const [editingId,   setEditingId  ] = useState(null)
  const [form,        setForm       ] = useState(EMPTY_FORM)
  const [saving,      setSaving     ] = useState(false)
  const [copiedId,    setCopiedId   ] = useState(null)
  const [expandedId,  setExpandedId ] = useState(null)

  const filtered = useMemo(() =>
    [...snippets]
      .filter(s => !filterCat || s.category === filterCat)
      .filter(s => !searchText ||
        s.title?.includes(searchText) ||
        s.description?.includes(searchText) ||
        s.code?.includes(searchText))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
  [snippets, filterCat, searchText])

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
        await updateById('snippets', editingId, { ...target, ...form })
      } else {
        await appendRow('snippets', { id: generateId(), title: form.title, description: form.description, category: form.category, code: form.code, created_at: now })
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

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>スニペット</span></TopBar>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
          データ取得エラー: {error}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>スニペット</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="スニペット"
          subtitle="GAS・JavaScript などのコードスニペットを登録・検索・コピーできます。"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={reload}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }}>
                ↻ 更新
              </button>
              <Btn kind="primary" icon={Icon.plus()} onClick={startAdd}>追加</Btn>
            </div>
          }
        />

        {/* 追加・編集フォーム */}
        {showForm && (
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.teal}`, padding: '20px 22px', marginBottom: 20, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16 }}>
              {editingId ? 'スニペットを編集' : '新しいスニペットを追加'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>タイトル *</label>
                <input type="text" style={inputStyle} value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="例: Gmailラベル取得" />
              </div>
              <div>
                <label style={labelStyle}>説明</label>
                <input type="text" style={inputStyle} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="簡単な説明..." />
              </div>
              <div>
                <label style={labelStyle}>カテゴリ</label>
                <select style={inputStyle} value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>コード *</label>
              <textarea
                rows={12}
                style={{ ...inputStyle, fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 12, lineHeight: 1.7, resize: 'vertical', background: '#0f1c2e', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8 }}
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                placeholder="コードをここに貼り付け..."
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="primary" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? '保存中...' : '保存'}
              </Btn>
              <Btn kind="ghost" onClick={handleCancel}>キャンセル</Btn>
            </div>
          </div>
        )}

        {/* フィルター・検索 */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <input type="text" placeholder="タイトル・コードで検索..."
            value={searchText} onChange={e => setSearchText(e.target.value)}
            style={{ fontSize: 13, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px', background: T.surface, outline: 'none', width: 240 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 999, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                  background: filterCat === cat ? T.teal : T.surfaceAlt,
                  color: filterCat === cat ? '#fff' : T.inkSoft,
                  border: `1px solid ${filterCat === cat ? T.teal : T.border}`,
                }}>
                {cat}
              </button>
            ))}
          </div>
          {(filterCat || searchText) && (
            <button onClick={() => { setFilterCat(''); setSearchText('') }}
              style={{ fontSize: 12, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              クリア
            </button>
          )}
          <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{filtered.length}件</span>
        </div>

        {/* スニペット一覧 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.muted, fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.muted, fontSize: 13 }}>
            {snippets.length === 0 ? '「追加」からスニペットを登録してください' : '条件に一致するスニペットがありません'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(snippet => {
              const isExpanded = expandedId === snippet.id
              return (
                <div key={snippet.id} style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : snippet.id)}
                      style={{ fontSize: 10, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, width: 18, textAlign: 'center' }}>
                      {isExpanded ? '▲' : '▶'}
                    </button>

                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: T.tealBg, color: T.teal, fontWeight: 600, flexShrink: 0, border: `1px solid ${T.tealLight}` }}>
                      {snippet.category || 'その他'}
                    </span>

                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : snippet.id)}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{snippet.title}</div>
                      {snippet.description && (
                        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 1 }}>{snippet.description}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => handleCopy(snippet)}
                        style={{
                          fontSize: 11, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                          background: copiedId === snippet.id ? T.successBg : T.surfaceAlt,
                          color: copiedId === snippet.id ? T.successText : T.inkSoft,
                          border: `1px solid ${copiedId === snippet.id ? T.success : T.border}`,
                          transition: 'background 0.2s',
                        }}>
                        {copiedId === snippet.id ? '✓ コピー済み' : 'コピー'}
                      </button>
                      <button onClick={() => startEdit(snippet)}
                        style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                        編集
                      </button>
                      <button onClick={() => handleDelete(snippet)}
                        style={{ fontSize: 12, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}>
                        削除
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ background: '#0f1c2e', padding: '16px 20px', overflowX: 'auto', borderTop: '1px solid #1e3a5f' }}>
                      <pre style={{ margin: 0, fontFamily: '"SF Mono", "Fira Code", "Courier New", monospace', fontSize: 12, lineHeight: 1.7, color: '#e2e8f0', whiteSpace: 'pre' }}>
                        {snippet.code}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
