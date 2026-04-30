import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSheets } from '../hooks/useSheets'
import { appendRow, generateId } from '../api/sheets'

const CATEGORIES = ['大学・高専_情報系', '大学・短大_非情報系', '専門学校', '企業', '行政', 'その他']

const CAT_COLORS = {
  '大学・高専_情報系':   { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
  '大学・短大_非情報系': { bg: '#fce7f3', text: '#be185d', border: '#fbcfe8' },
  '専門学校':           { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  '企業':               { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  '行政':               { bg: '#fef9c3', text: '#a16207', border: '#fef08a' },
  'その他':             { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
}

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  category: '',
  stakeholder_id: '',
  source: '',
  title: '',
  content: '',
  tags: '',
}

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`
}

const PRIMARY = '#06b6d4'
const BORDER   = '#e8edf2'
const TEXT_PRIMARY   = '#1e2d3d'
const TEXT_MUTED     = '#94a3b8'
const TEXT_SECONDARY = '#64748b'

export default function FieldNote() {
  const { rows: notes,       loading, reload } = useSheets('field_notes')
  const { rows: stakeholders                 } = useSheets('stakeholders')

  const [activeTab,   setActiveTab  ] = useState('all')
  const [showForm,    setShowForm   ] = useState(false)
  const [form,        setForm       ] = useState(EMPTY_FORM)
  const [saving,      setSaving     ] = useState(false)
  const [expandedId,  setExpandedId ] = useState(null)

  const shById = useMemo(() =>
    Object.fromEntries(stakeholders.map(s => [s.id, s]))
  , [stakeholders])

  // カテゴリが一致するSHを先頭に
  const shOptions = useMemo(() => {
    const inCat  = stakeholders.filter(s => s.institution_type === form.category)
    const others = stakeholders.filter(s => s.institution_type !== form.category)
    return [...inCat, ...others]
  }, [stakeholders, form.category])

  const filtered = useMemo(() =>
    notes
      .filter(n => activeTab === 'all' || n.category === activeTab)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  , [notes, activeTab])

  const countOf = (cat) => notes.filter(n => n.category === cat).length

  const handleSave = async () => {
    if (!form.title || !form.category || !form.date) {
      alert('日付・カテゴリ・タイトルは必須です')
      return
    }
    setSaving(true)
    try {
      await appendRow('field_notes', [
        generateId(),
        form.date,
        form.category,
        form.stakeholder_id,
        form.source,
        form.title,
        form.content,
        form.tags,
        new Date().toISOString(),
      ])
      await reload()
      setForm(EMPTY_FORM)
      setShowForm(false)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  const inp = (overrides) => ({
    width: '100%', fontSize: 13, border: `1px solid ${BORDER}`,
    borderRadius: 6, padding: '7px 10px', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
    ...overrides,
  })

  return (
    <div className="p-6">

      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>フィールドノート</h1>
          <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6 }}>
            採用・就職に関する情報を得たときは、こちらのノートに集約していきましょう！<br />
            大学・企業・行政などあらゆる現場からの声を記録・蓄積することで、事業の分析や戦略立案に活かせます。
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>新規記録
        </button>
      </div>

      {/* 入力フォーム（展開式） */}
      {showForm && (
        <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 16 }}>新規フィールドノート</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>収集日 *</label>
              <input type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                style={inp()} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>カテゴリ *</label>
              <select value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value, stakeholder_id: '' }))}
                style={inp()}>
                <option value="">選択...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>ステークホルダー</label>
              <select value={form.stakeholder_id}
                onChange={e => setForm(p => ({ ...p, stakeholder_id: e.target.value }))}
                style={inp()}>
                <option value="">（なし）</option>
                {shOptions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.institution_type === form.category ? '★ ' : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>情報源（人名・機関名など）</label>
            <input type="text" value={form.source}
              onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
              placeholder="例: 〇〇大学 田中教授、企業説明会でのヒアリング"
              style={inp()} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>タイトル *</label>
            <input type="text" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="例: IT系学生の就職意識について"
              style={inp()} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>
              本文
              <span style={{ marginLeft: 8, fontSize: 10, color: '#06b6d4', fontWeight: 500 }}>Markdown 対応</span>
            </label>
            <textarea value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              rows={6}
              placeholder={'収集した情報を詳しく記録してください...\n\n# 見出し\n## 小見出し\n- 箇条書き\n| 列1 | 列2 |'}
              style={{ ...inp(), resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>タグ（カンマ区切り）</label>
            <input type="text" value={form.tags}
              onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="例: 就活意識, 大手志向, インターン"
              style={inp()} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '8px 24px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              style={{ padding: '8px 16px', background: '#f1f5f9', color: TEXT_SECONDARY, border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* カテゴリタブ */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 20, overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('all')}
          style={{
            padding: '10px 16px', fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit',
            fontWeight: activeTab === 'all' ? 700 : 400,
            color: activeTab === 'all' ? PRIMARY : TEXT_MUTED,
            background: 'none', border: 'none',
            borderBottom: activeTab === 'all' ? `2px solid ${PRIMARY}` : '2px solid transparent',
            marginBottom: -1, cursor: 'pointer',
          }}>
          全件 <span style={{ fontSize: 10, background: '#f1f5f9', color: TEXT_MUTED, borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>{notes.length}</span>
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveTab(cat)}
            style={{
              padding: '10px 16px', fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit',
              fontWeight: activeTab === cat ? 700 : 400,
              color: activeTab === cat ? PRIMARY : TEXT_MUTED,
              background: 'none', border: 'none',
              borderBottom: activeTab === cat ? `2px solid ${PRIMARY}` : '2px solid transparent',
              marginBottom: -1, cursor: 'pointer',
            }}>
            {cat}
            <span style={{ fontSize: 10, background: '#f1f5f9', color: TEXT_MUTED, borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>
              {countOf(cat)}
            </span>
          </button>
        ))}
      </div>

      {/* AI解析バナー（カテゴリタブ選択時） */}
      {activeTab !== 'all' && (
        <div style={{
          background: 'linear-gradient(135deg, #f0f9ff, #e0f7fa)',
          border: '1px dashed #06b6d4', borderRadius: 10,
          padding: '12px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2' }}>✦ AI解析</span>
            <span style={{ fontSize: 12, color: TEXT_SECONDARY, marginLeft: 8 }}>
              「{activeTab}」の記録をAIが集約・分析します
            </span>
          </div>
          <button disabled
            style={{ fontSize: 11, padding: '5px 14px', borderRadius: 6, background: '#e2e8f0', color: TEXT_MUTED, border: 'none', cursor: 'not-allowed', fontFamily: 'inherit' }}>
            準備中
          </button>
        </div>
      )}

      {/* ノート一覧 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '60px 0', fontSize: 14 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '60px 0', fontSize: 14 }}>
          {notes.length === 0
            ? '「新規記録」から最初のフィールドノートを追加してください'
            : 'このカテゴリの記録はありません'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(n => {
            const cat       = CAT_COLORS[n.category] || CAT_COLORS['その他']
            const sh        = shById[n.stakeholder_id]
            const isOpen    = expandedId === n.id
            const tags      = n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : []

            return (
              <div key={n.id}
                style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => setExpandedId(isOpen ? null : n.id)}>

                <div style={{ padding: '14px 18px' }}>
                  {/* 1行目: バッジ・タイトル・日付 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
                      fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {n.category}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.4, flex: 1 }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 11, color: TEXT_MUTED, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDate(n.date)}
                    </span>
                  </div>

                  {/* 2行目: SH・情報源 */}
                  {(sh || n.source) && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>
                      {sh     && <span>SH: <span style={{ color: TEXT_PRIMARY }}>{sh.name}</span></span>}
                      {n.source && <span>情報源: <span style={{ color: TEXT_PRIMARY }}>{n.source}</span></span>}
                    </div>
                  )}

                  {/* タグ */}
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#f1f5f9', color: TEXT_SECONDARY }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 本文プレビュー（折りたたみ時・先頭2行） */}
                  {!isOpen && n.content && (
                    <p style={{
                      fontSize: 12, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 1.6,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {n.content.replace(/^#+\s/gm, '').replace(/[*_`|]/g, '')}
                    </p>
                  )}
                </div>

                {/* 本文展開（Markdownレンダリング） */}
                {isOpen && n.content && (
                  <div style={{ padding: '12px 18px 16px', borderTop: `1px solid ${BORDER}` }}>
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
