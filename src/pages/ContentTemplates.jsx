import { useState, useMemo, useEffect } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, deleteById, generateId } from '../api/sheets'
import { ALL_SMALL_CATS } from '../constants/categories'
import { T } from '../constants/theme'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'

export const TEMPLATE_TYPES = [
  { key: 'company_site', label: '企業向けサイト', format: 'html', desc: 'WordPress掲載・企業向けHTMLコンテンツ', multi: false },
  { key: 'student_site', label: '学生向けサイト', format: 'html', desc: 'WordPress掲載・学生向けHTMLコンテンツ', multi: false },
  { key: 'news',         label: '新着情報',       format: 'html', desc: '学生向けサイト新着情報HTML',           multi: false },
  { key: 'mail',         label: 'メール',         format: 'text', desc: '各種メール案内文（複数種別登録可）',   multi: true  },
  { key: 'line',         label: 'LINE案内文',     format: 'text', desc: '学生向けLINE公式アカウント案内文',     multi: false },
]

export const PLACEHOLDERS = [
  { key: '{{event_name}}',         desc: 'イベント名' },
  { key: '{{event_date_range}}',   desc: '開催日程（開始〜終了 or 終了日のみ）' },
  { key: '{{event_date}}',         desc: '終了日（開催日）' },
  { key: '{{event_start_date}}',   desc: '開始日' },
  { key: '{{venue}}',              desc: '会場' },
  { key: '{{company_list}}',       desc: '参加企業リスト（HTML: <ul><li>、テキスト: ・箇条書き）' },
  { key: '{{student_goal}}',       desc: '学生参加目標数' },
  { key: '{{company_goal}}',       desc: '企業参加目標数' },
  { key: '{{portal_student_url}}', desc: '学生向けポータルURL' },
  { key: '{{portal_company_url}}', desc: '企業向けポータルURL' },
  { key: '{{year}}',               desc: '年' },
  { key: '{{month}}',              desc: '月' },
  { key: '{{deadline}}',           desc: '申込締切日（生成時に入力）' },
  { key: '{{company_cards_js}}',   desc: '企業カードJS（スプレッドシートから自動生成）' },
  { key: '{{company_messages}}',   desc: '企業メッセージHTML（スプレッドシートから自動生成）' },
]

const SMALL_CAT_NAMES = ALL_SMALL_CATS.map(s => s.name)

const sectionStyle = {
  background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`,
  overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
}

export default function ContentTemplates() {
  const { rows: templates, reload } = useSheets('content_templates')

  const [selectedCat,    setSelectedCat   ] = useState(SMALL_CAT_NAMES[0])
  const [activeType,     setActiveType    ] = useState('company_site')
  const [content,        setContent       ] = useState('')
  const [saving,         setSaving        ] = useState(false)
  const [saved,          setSaved         ] = useState(false)

  // メール（multi）用ステート
  const [selectedMailId, setSelectedMailId] = useState(null)
  const [newMailName,    setNewMailName   ] = useState('')
  const [addingMail,     setAddingMail    ] = useState(false)
  const [editingMailId,  setEditingMailId ] = useState(null)
  const [editingMailName,setEditingMailName] = useState('')

  const activeTypeDef = TEMPLATE_TYPES.find(t => t.key === activeType)
  const isMulti       = activeTypeDef?.multi === true

  // 単一テンプレート（multi:false）
  const currentTemplate = useMemo(() =>
    !isMulti ? templates.find(t => t.small_cat === selectedCat && (t.template_type === activeType || (activeType === 'mail' && t.template_type === 'mailing'))) : null,
  [templates, selectedCat, activeType, isMulti])

  // メールテンプレート一覧（multi:true）
  const mailTemplates = useMemo(() =>
    templates.filter(t => t.small_cat === selectedCat && (t.template_type === 'mail' || t.template_type === 'mailing')),
  [templates, selectedCat])

  const selectedMailTmpl = useMemo(() =>
    mailTemplates.find(t => t.id === selectedMailId),
  [mailTemplates, selectedMailId])

  // selectedCat / activeType が変わったらリセット
  useEffect(() => {
    if (isMulti) {
      setSelectedMailId(null)
      setContent('')
    } else {
      setContent(currentTemplate?.content || '')
    }
    setSaved(false)
  }, [selectedCat, activeType])

  // メールテンプレート選択時にcontentを更新
  useEffect(() => {
    if (isMulti) {
      setContent(selectedMailTmpl?.content || '')
      setSaved(false)
    }
  }, [selectedMailId, selectedMailTmpl])

  // content_templates.content の変化に追従（単一のみ）
  useEffect(() => {
    if (!isMulti) {
      setContent(currentTemplate?.content || '')
      setSaved(false)
    }
  }, [currentTemplate])

  /* ── 保存（単一テンプレート） ── */
  const handleSave = async () => {
    setSaving(true)
    try {
      if (isMulti) {
        if (!selectedMailId) return
        await updateById('content_templates', selectedMailId, { content, updated_at: new Date().toISOString() })
      } else {
        if (currentTemplate) {
          await updateById('content_templates', currentTemplate.id, { content, updated_at: new Date().toISOString() })
        } else {
          await appendRow('content_templates', { id: generateId(), small_cat: selectedCat, template_type: activeType, name: '', content, updated_at: new Date().toISOString() })
        }
      }
      reload()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert('保存失敗: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  /* ── メールテンプレート追加 ── */
  const handleAddMail = async () => {
    if (!newMailName.trim()) return
    const id = generateId()
    try {
      await appendRow('content_templates', { id, small_cat: selectedCat, template_type: 'mail', name: newMailName.trim(), content: '', updated_at: new Date().toISOString() })
      setNewMailName('')
      setAddingMail(false)
      reload()
      setTimeout(() => setSelectedMailId(id), 300)
    } catch (e) {
      alert('追加失敗: ' + e.message)
    }
  }

  /* ── メールテンプレート削除 ── */
  const handleDeleteMail = async (id) => {
    const tmpl = mailTemplates.find(t => t.id === id)
    if (!confirm(`「${tmpl?.name || 'このテンプレート'}」を削除しますか？`)) return
    try {
      await deleteById('content_templates', id)
      if (selectedMailId === id) { setSelectedMailId(null); setContent('') }
      reload()
    } catch (e) {
      alert('削除失敗: ' + e.message)
    }
  }

  /* ── メールテンプレート名変更 ── */
  const handleSaveMailName = async (id) => {
    if (!editingMailName.trim()) return
    try {
      await updateById('content_templates', id, { name: editingMailName.trim() })
      setEditingMailId(null)
      reload()
    } catch (e) {
      alert('更新失敗: ' + e.message)
    }
  }

  /* ── プレースホルダー挿入 ── */
  const insertPlaceholder = (key) => {
    const ta = document.querySelector('#template-editor')
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = content.slice(0, start) + key + content.slice(end)
    setContent(next)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + key.length, start + key.length) }, 0)
  }

  const canSave = isMulti ? Boolean(selectedMailId) : true

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>コンテンツテンプレート</span></TopBar>
      <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PageHeader
          title="コンテンツテンプレート"
          subtitle="小分類ごとにWebサイト・メール・LINEの掲載文テンプレートを管理します。"
        />

        {/* 小分類選択 */}
        <div style={{ ...sectionStyle, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, whiteSpace: 'nowrap' }}>小分類</span>
          <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: 'inherit', color: T.ink, background: T.surface, outline: 'none', flex: 1, maxWidth: 400 }}>
            {SMALL_CAT_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <span style={{ fontSize: 11, color: T.muted }}>
            登録済み：{TEMPLATE_TYPES.filter(t => {
              if (t.multi) return templates.some(tmpl => tmpl.small_cat === selectedCat && (tmpl.template_type === t.key || tmpl.template_type === 'mailing') && tmpl.content)
              return templates.some(tmpl => tmpl.small_cat === selectedCat && tmpl.template_type === t.key && tmpl.content)
            }).length} / {TEMPLATE_TYPES.length} 種類
          </span>
        </div>

        {/* テンプレートタイプタブ */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}` }}>
          {TEMPLATE_TYPES.map(t => {
            const hasData = t.multi
              ? templates.some(tmpl => tmpl.small_cat === selectedCat && (tmpl.template_type === t.key || tmpl.template_type === 'mailing') && tmpl.content)
              : templates.some(tmpl => tmpl.small_cat === selectedCat && tmpl.template_type === t.key && tmpl.content)
            const isActive = activeType === t.key
            const mailCount = t.multi ? templates.filter(tmpl => tmpl.small_cat === selectedCat && (tmpl.template_type === t.key || tmpl.template_type === 'mailing')).length : 0
            return (
              <button key={t.key} onClick={() => setActiveType(t.key)}
                style={{
                  fontSize: 12, padding: '9px 16px', cursor: 'pointer', fontWeight: 600,
                  background: 'transparent', border: 'none', fontFamily: 'inherit',
                  borderBottom: isActive ? `2px solid ${T.teal}` : '2px solid transparent',
                  color: isActive ? T.teal : T.inkSoft, marginBottom: -1,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                {t.label}
                {t.multi && mailCount > 0 && (
                  <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, background: isActive ? T.teal : T.surfaceAlt, color: isActive ? '#fff' : T.muted, fontWeight: 700 }}>{mailCount}</span>
                )}
                {!t.multi && hasData && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? T.teal : T.success, display: 'inline-block', flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>

        {/* エディター + プレースホルダー */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, paddingTop: 16, minHeight: 0 }}>

          {/* ── メール（multi: true）── */}
          {isMulti ? (
            <div style={{ display: 'flex', gap: 14, minHeight: 0 }}>

              {/* 左: メールテンプレート一覧 */}
              <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.muted }}>メール種別</span>
                  <button onClick={() => setAddingMail(true)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: T.teal, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                    ＋ 追加
                  </button>
                </div>

                {/* 追加フォーム */}
                {addingMail && (
                  <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input autoFocus value={newMailName} onChange={e => setNewMailName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddMail(); if (e.key === 'Escape') { setAddingMail(false); setNewMailName('') } }}
                      placeholder="例: MISAメーリングリスト"
                      style={{ fontSize: 12, padding: '6px 8px', border: `1px solid ${T.teal}`, borderRadius: 4, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={handleAddMail} disabled={!newMailName.trim()}
                        style={{ fontSize: 11, padding: '4px 10px', background: T.teal, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', flex: 1 }}>
                        追加
                      </button>
                      <button onClick={() => { setAddingMail(false); setNewMailName('') }}
                        style={{ fontSize: 11, padding: '4px 8px', background: T.surfaceAlt, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                )}

                {/* テンプレート一覧 */}
                {mailTemplates.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.muted, padding: '16px 0', textAlign: 'center' }}>
                    まだ登録がありません<br />「＋ 追加」から作成してください
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {mailTemplates.map(tmpl => (
                      <div key={tmpl.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 0,
                          borderRadius: 4, overflow: 'hidden',
                          background: selectedMailId === tmpl.id ? T.tealBg : T.surfaceAlt,
                          border: `1px solid ${selectedMailId === tmpl.id ? T.teal : T.border}`,
                        }}>
                        {editingMailId === tmpl.id ? (
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                            <input autoFocus value={editingMailName} onChange={e => setEditingMailName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveMailName(tmpl.id); if (e.key === 'Escape') setEditingMailId(null) }}
                              style={{ flex: 1, fontSize: 12, padding: '2px 4px', border: `1px solid ${T.teal}`, borderRadius: 3, outline: 'none', fontFamily: 'inherit' }}
                            />
                            <button onClick={() => handleSaveMailName(tmpl.id)}
                              style={{ fontSize: 10, padding: '2px 6px', background: T.teal, color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                              保存
                            </button>
                            <button onClick={() => setEditingMailId(null)}
                              style={{ fontSize: 10, color: T.muted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => setSelectedMailId(tmpl.id)}
                              style={{
                                flex: 1, textAlign: 'left', fontSize: 12, padding: '7px 10px',
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: selectedMailId === tmpl.id ? T.teal : T.ink, fontWeight: selectedMailId === tmpl.id ? 700 : 400,
                                fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}>
                              {tmpl.name || '（名称なし）'}
                              {tmpl.content ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.success, flexShrink: 0 }} /> : null}
                            </button>
                            <button onClick={() => { setEditingMailId(tmpl.id); setEditingMailName(tmpl.name || '') }}
                              style={{ fontSize: 10, padding: '0 5px', color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: '30px' }}
                              title="名称を変更">✎</button>
                            <button onClick={() => handleDeleteMail(tmpl.id)}
                              style={{ fontSize: 11, padding: '0 6px', color: T.muted, background: 'transparent', borderLeft: `1px solid ${T.border}`, borderTop: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', lineHeight: '30px' }}
                              title="削除">×</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 右: エディター */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                {selectedMailTmpl ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{selectedMailTmpl.name}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: T.warningBg, color: T.warningText, fontWeight: 600 }}>TEXT</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {saved && <span style={{ fontSize: 12, color: T.success, fontWeight: 600 }}>✓ 保存しました</span>}
                        <Btn kind="primary" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
                          {saving ? '保存中...' : '保存'}
                        </Btn>
                      </div>
                    </div>
                    <textarea id="template-editor" value={content}
                      onChange={e => { setContent(e.target.value); setSaved(false) }}
                      placeholder={`${selectedMailTmpl.name}のテンプレートを入力...\n\n例:\n件名：{{event_name}}のご案内\n\n各位\n\n{{event_name}}のご案内です。\n開催日時：{{event_date_range}}\n会場：{{venue}}`}
                      style={{ flex: 1, minHeight: 400, resize: 'vertical', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, border: `1px solid ${T.border}`, borderRadius: 4, padding: '14px 16px', background: T.surface, color: T.ink, outline: 'none' }}
                    />
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 4 }}>
                    左のリストからメール種別を選択してください
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── 単一テンプレート（multi: false）── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{activeTypeDef?.label}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>{activeTypeDef?.desc}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: activeTypeDef?.format === 'html' ? T.infoBg : T.warningBg, color: activeTypeDef?.format === 'html' ? T.infoText : T.warningText }}>
                    {activeTypeDef?.format === 'html' ? 'HTML' : 'TEXT'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {saved && <span style={{ fontSize: 12, color: T.success, fontWeight: 600 }}>✓ 保存しました</span>}
                  <Btn kind="primary" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
                    {saving ? '保存中...' : '保存'}
                  </Btn>
                </div>
              </div>
              <textarea id="template-editor" value={content}
                onChange={e => { setContent(e.target.value); setSaved(false) }}
                placeholder={`${selectedCat}の「${activeTypeDef?.label}」テンプレートを入力...\n\nプレースホルダー例:\n{{event_name}}（イベント名）\n{{event_date_range}}（開催日程）\n{{venue}}（会場）`}
                style={{
                  flex: 1, minHeight: 400, resize: 'vertical',
                  fontFamily: activeTypeDef?.format === 'html' ? '"SFMono-Regular", Consolas, monospace' : 'inherit',
                  fontSize: 13, lineHeight: 1.7, border: `1px solid ${T.border}`, borderRadius: 4, padding: '14px 16px',
                  background: activeTypeDef?.format === 'html' ? '#f8fafc' : T.surface, color: T.ink, outline: 'none',
                }}
              />
            </div>
          )}

          {/* プレースホルダー一覧 */}
          <div>
            <div style={{ ...sectionStyle, position: 'sticky', top: 24 }}>
              <div style={{ padding: '10px 14px', background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em' }}>
                プレースホルダー（クリックで挿入）
              </div>
              <div>
                {PLACEHOLDERS.map((ph, i) => (
                  <div key={ph.key} onClick={() => insertPlaceholder(ph.key)}
                    style={{ padding: '7px 14px', cursor: 'pointer', borderBottom: i < PLACEHOLDERS.length - 1 ? `1px solid ${T.borderSoft}` : 'none', transition: 'background 0.1s' }}
                    onMouseOver={e => e.currentTarget.style.background = T.tealBg}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: T.teal, fontWeight: 700, marginBottom: 1 }}>{ph.key}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{ph.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
