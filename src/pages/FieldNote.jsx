import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, deleteById, generateId } from '../api/sheets'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'

const CATEGORIES = ['大学・高専_情報系', '大学・短大_非情報系', '専門学校', '企業', '行政', 'その他']

const CAT_COLORS = {
  '大学・高専_情報系':   { bg: T.catBBg, text: '#7a5e94', border: '#d5c8e8' },
  '大学・短大_非情報系': { bg: '#f9ebf4', text: '#9b4f7e', border: '#e8c6d8' },
  '専門学校':            { bg: T.catCBg, text: '#3a6f9c', border: '#b9d4ec' },
  '企業':                { bg: T.catABg, text: '#1f8975', border: '#b0d9d0' },
  '行政':                { bg: T.warningBg, text: '#b97a1d', border: '#f5d99a' },
  'その他':              { bg: '#f1f3f5', text: '#5b6b78', border: T.border },
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

export default function FieldNote() {
  const { rows: notes,       loading, reload } = useSheets('field_notes')
  const { rows: stakeholders                 } = useSheets('stakeholders')

  const [activeTab,  setActiveTab ] = useState('all')
  const [showForm,   setShowForm  ] = useState(false)
  const [editingId,  setEditingId ] = useState(null)   // null = 新規, string = 編集中ノートid
  const [form,       setForm      ] = useState(EMPTY_FORM)
  const [saving,     setSaving    ] = useState(false)
  const [deleting,   setDeleting  ] = useState(null)   // 削除中ノートid
  const [expandedId, setExpandedId] = useState(null)

  const shById = useMemo(() =>
    Object.fromEntries(stakeholders.map(s => [s.id, s]))
  , [stakeholders])

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

  const openNewForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEditForm = (note, e) => {
    e.stopPropagation()
    setEditingId(note.id)
    setForm({
      date:           note.date           || '',
      category:       note.category       || '',
      stakeholder_id: note.stakeholder_id || '',
      source:         note.source         || '',
      title:          note.title          || '',
      content:        note.content        || '',
      tags:           note.tags           || '',
    })
    setShowForm(true)
    setExpandedId(null)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!form.title || !form.category || !form.date) {
      alert('日付・カテゴリ・タイトルは必須です')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await updateById('field_notes', editingId, {
          id: editingId,
          date: form.date, category: form.category,
          stakeholder_id: form.stakeholder_id, source: form.source,
          title: form.title, content: form.content, tags: form.tags,
        })
      } else {
        await appendRow('field_notes', [
          generateId(), form.date, form.category, form.stakeholder_id,
          form.source, form.title, form.content, form.tags,
          new Date().toISOString(),
        ])
      }
      await reload()
      closeForm()
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (note, e) => {
    e.stopPropagation()
    if (!window.confirm(`「${note.title}」を削除しますか？この操作は取り消せません。`)) return
    setDeleting(note.id)
    try {
      await deleteById('field_notes', note.id)
      await reload()
      if (expandedId === note.id) setExpandedId(null)
    } catch (err) { alert('削除失敗: ' + err.message) }
    finally { setDeleting(null) }
  }

  const inputStyle = {
    width: '100%', fontSize: 13, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '9px 12px', fontFamily: 'inherit', outline: 'none',
    color: T.ink, background: T.surface,
  }

  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }

  const iconBtn = (onClick, title, children, danger) => (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 4, border: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', color: danger ? T.danger : T.muted,
        flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? T.dangerBg : T.surfaceAlt }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>フィールドノート</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="フィールドノート"
          subtitle="採用・就職に関する情報を得たときは、こちらのノートに集約していきましょう。大学・企業・行政などあらゆる現場からの声を記録・蓄積することで、事業の分析や戦略立案に活かせます。"
          actions={
            <Btn kind="primary" icon={Icon.plus()} onClick={openNewForm}>
              新規記録
            </Btn>
          }
        />

        {/* 入力・編集フォーム */}
        {showForm && (
          <div style={{ background: T.surface, border: `1px solid ${T.teal}`, borderRadius: 4, padding: '20px 22px', marginBottom: 20, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16 }}>
              {editingId ? 'フィールドノートを編集' : '新規フィールドノート'}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>収集日 *</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>カテゴリ *</label>
                <select value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value, stakeholder_id: '' }))}
                  style={inputStyle}>
                  <option value="">選択...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>ステークホルダー</label>
                <select value={form.stakeholder_id}
                  onChange={e => setForm(p => ({ ...p, stakeholder_id: e.target.value }))}
                  style={inputStyle}>
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
              <label style={labelStyle}>情報源（人名・機関名など）</label>
              <input type="text" value={form.source}
                onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                placeholder="例: 〇〇大学 田中教授、企業説明会でのヒアリング"
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>タイトル *</label>
              <input type="text" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="例: IT系学生の就職意識について"
                style={inputStyle} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>
                本文
                <span style={{ marginLeft: 8, fontSize: 10, color: T.teal, fontWeight: 500 }}>Markdown 対応</span>
              </label>
              <textarea value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                rows={6}
                placeholder={'収集した情報を詳しく記録してください...\n\n# 見出し\n## 小見出し\n- 箇条書き\n| 列1 | 列2 |'}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>タグ（カンマ区切り）</label>
              <input type="text" value={form.tags}
                onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                placeholder="例: 就活意識, 大手志向, インターン"
                style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="primary" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? '保存中...' : (editingId ? '更新' : '保存')}
              </Btn>
              <Btn kind="ghost" onClick={closeForm}>キャンセル</Btn>
            </div>
          </div>
        )}

        {/* カテゴリタブ */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, marginBottom: 20, overflowX: 'auto' }}>
          {[{ key: 'all', label: '全件', count: notes.length }, ...CATEGORIES.map(c => ({ key: c, label: c, count: countOf(c) }))].map(({ key, label, count }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap', fontFamily: 'inherit',
                fontWeight: activeTab === key ? 700 : 500,
                color: activeTab === key ? T.teal : T.inkSoft,
                background: 'none', border: 'none',
                borderBottom: activeTab === key ? `2px solid ${T.teal}` : '2px solid transparent',
                marginBottom: -1, cursor: 'pointer',
              }}>
              {label}
              <span style={{ fontSize: 11, fontWeight: 600, color: activeTab === key ? T.teal : T.muted, marginLeft: 5 }}>{count}</span>
            </button>
          ))}
        </div>

        {/* AI解析バナー */}
        {activeTab !== 'all' && (
          <div style={{
            background: T.tealBg, border: `1px dashed ${T.tealLight}`, borderRadius: 4,
            padding: '12px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.teal }}>✦ AI解析</span>
              <span style={{ fontSize: 12, color: T.inkSoft, marginLeft: 8 }}>
                「{activeTab}」の記録をAIが集約・分析します
              </span>
            </div>
            <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: T.borderSoft, color: T.muted, fontWeight: 500 }}>
              準備中
            </span>
          </div>
        )}

        {/* ノート一覧 */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>
            {notes.length === 0
              ? '「新規記録」から最初のフィールドノートを追加してください'
              : 'このカテゴリの記録はありません'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(n => {
              const cat    = CAT_COLORS[n.category] || CAT_COLORS['その他']
              const sh     = shById[n.stakeholder_id]
              const isOpen = expandedId === n.id
              const tags   = n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : []
              const isDel  = deleting === n.id

              return (
                <div key={n.id}
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.02)', opacity: isDel ? 0.5 : 1 }}
                  onClick={() => setExpandedId(isOpen ? null : n.id)}>

                  <div style={{ padding: '14px 18px' }}>
                    {/* 1行目: バッジ・タイトル・日付・アクション */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10, padding: '3px 9px', borderRadius: 999,
                        background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`,
                        fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.4,
                      }}>
                        {n.category}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.4, flex: 1 }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(n.date)}
                      </span>
                      {/* 編集・削除ボタン */}
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        {iconBtn(e => openEditForm(n, e), '編集',
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        )}
                        {iconBtn(e => handleDelete(n, e), '削除',
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>,
                          true
                        )}
                      </div>
                    </div>

                    {/* SH・情報源 */}
                    {(sh || n.source) && (
                      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.muted, marginBottom: 6 }}>
                        {sh      && <span>SH: <span style={{ color: T.inkSoft, fontWeight: 500 }}>{sh.name}</span></span>}
                        {n.source && <span>情報源: <span style={{ color: T.inkSoft, fontWeight: 500 }}>{n.source}</span></span>}
                      </div>
                    )}

                    {/* タグ */}
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {tags.map(tag => (
                          <span key={tag} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: T.surfaceAlt, color: T.inkSoft, border: `1px solid ${T.borderSoft}`, fontWeight: 500 }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 本文プレビュー */}
                    {!isOpen && n.content && (
                      <p style={{
                        fontSize: 12, color: T.inkSoft, marginTop: 8, lineHeight: 1.6,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {n.content.replace(/^#+\s/gm, '').replace(/[*_`|]/g, '')}
                      </p>
                    )}
                  </div>

                  {/* 本文展開（Markdownレンダリング） */}
                  {isOpen && n.content && (
                    <div style={{ padding: '12px 18px 16px', borderTop: `1px solid ${T.borderSoft}`, background: T.surfaceAlt }}>
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
    </div>
  )
}
