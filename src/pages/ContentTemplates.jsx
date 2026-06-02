import { useState, useMemo, useEffect } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'
import { ALL_SMALL_CATS } from '../constants/categories'
import { T } from '../constants/theme'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'

export const TEMPLATE_TYPES = [
  { key: 'company_site', label: '企業向けサイト',   format: 'html', desc: 'WordPress掲載・企業向けHTMLコンテンツ' },
  { key: 'student_site', label: '学生向けサイト',   format: 'html', desc: 'WordPress掲載・学生向けHTMLコンテンツ' },
  { key: 'news',         label: '新着情報',         format: 'html', desc: '学生向けサイト新着情報HTML' },
  { key: 'mailing',      label: 'メーリングリスト', format: 'text', desc: '業界団体メーリングリスト案内文' },
  { key: 'line',         label: 'LINE案内文',       format: 'text', desc: '学生向けLINE公式アカウント案内文' },
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
]

const SMALL_CAT_NAMES = ALL_SMALL_CATS.map(s => s.name)

const sectionStyle = {
  background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`,
  overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
}

export default function ContentTemplates() {
  const { rows: templates, reload } = useSheets('content_templates')

  const [selectedCat, setSelectedCat] = useState(SMALL_CAT_NAMES[0])
  const [activeType,  setActiveType ] = useState('company_site')
  const [content,     setContent    ] = useState('')
  const [saving,      setSaving     ] = useState(false)
  const [saved,       setSaved      ] = useState(false)

  const currentTemplate = useMemo(() =>
    templates.find(t => t.small_cat === selectedCat && t.template_type === activeType),
  [templates, selectedCat, activeType])

  useEffect(() => {
    setContent(currentTemplate?.content || '')
    setSaved(false)
  }, [currentTemplate])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (currentTemplate) {
        await updateById('content_templates', currentTemplate.id, {
          content,
          updated_at: new Date().toISOString(),
        })
      } else {
        await appendRow('content_templates', {
          id: generateId(),
          small_cat: selectedCat,
          template_type: activeType,
          content,
          updated_at: new Date().toISOString(),
        })
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

  const insertPlaceholder = (key) => {
    const ta = document.querySelector('#template-editor')
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = content.slice(0, start) + key + content.slice(end)
    setContent(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + key.length, start + key.length)
    }, 0)
  }

  const activeTypeObj = TEMPLATE_TYPES.find(t => t.key === activeType)

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
          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            style={{ fontSize: 13, padding: '6px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: 'inherit', color: T.ink, background: T.surface, outline: 'none', flex: 1, maxWidth: 400 }}>
            {SMALL_CAT_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <span style={{ fontSize: 11, color: T.muted }}>
            登録済み：{TEMPLATE_TYPES.filter(t => templates.some(tmpl => tmpl.small_cat === selectedCat && tmpl.template_type === t.key && tmpl.content)).length} / {TEMPLATE_TYPES.length} 種類
          </span>
        </div>

        {/* テンプレートタイプタブ */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}` }}>
          {TEMPLATE_TYPES.map(t => {
            const hasData = templates.some(tmpl => tmpl.small_cat === selectedCat && tmpl.template_type === t.key && tmpl.content)
            const isActive = activeType === t.key
            return (
              <button key={t.key} onClick={() => setActiveType(t.key)}
                style={{
                  fontSize: 12, padding: '9px 16px', cursor: 'pointer', fontWeight: 600,
                  background: 'transparent', border: 'none', fontFamily: 'inherit',
                  borderBottom: isActive ? `2px solid ${T.teal}` : '2px solid transparent',
                  color: isActive ? T.teal : T.inkSoft,
                  marginBottom: -1, display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {t.label}
                {hasData && (
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? T.teal : T.success, display: 'inline-block', flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>

        {/* エディター + プレースホルダー */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16, paddingTop: 16, minHeight: 0 }}>

          {/* エディター */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{activeTypeObj?.label}</span>
                <span style={{ fontSize: 11, color: T.muted }}>{activeTypeObj?.desc}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  background: activeTypeObj?.format === 'html' ? T.infoBg : T.warningBg,
                  color: activeTypeObj?.format === 'html' ? T.infoText : T.warningText,
                }}>
                  {activeTypeObj?.format === 'html' ? 'HTML' : 'TEXT'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saved && <span style={{ fontSize: 12, color: T.success, fontWeight: 600 }}>✓ 保存しました</span>}
                <Btn kind="primary" onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>
                  {saving ? '保存中...' : '保存'}
                </Btn>
              </div>
            </div>

            <textarea
              id="template-editor"
              value={content}
              onChange={e => { setContent(e.target.value); setSaved(false) }}
              placeholder={`${selectedCat}の「${activeTypeObj?.label}」テンプレートを入力...\n\n例:\n{{event_name}}（イベント名）\n{{event_date_range}}（開催日程）\n{{venue}}（会場）\n{{company_list}}（参加企業リスト）\n{{deadline}}（申込締切日）`}
              style={{
                flex: 1, minHeight: 400, resize: 'vertical',
                fontFamily: activeTypeObj?.format === 'html' ? '"SFMono-Regular", Consolas, monospace' : 'inherit',
                fontSize: 13, lineHeight: 1.7,
                border: `1px solid ${T.border}`, borderRadius: 4, padding: '14px 16px',
                background: activeTypeObj?.format === 'html' ? '#f8fafc' : T.surface,
                color: T.ink, outline: 'none',
              }}
            />
          </div>

          {/* プレースホルダー一覧 */}
          <div>
            <div style={{ ...sectionStyle, position: 'sticky', top: 24 }}>
              <div style={{ padding: '10px 14px', background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em' }}>
                プレースホルダー（クリックで挿入）
              </div>
              <div>
                {PLACEHOLDERS.map((ph, i) => (
                  <div key={ph.key}
                    onClick={() => insertPlaceholder(ph.key)}
                    style={{
                      padding: '7px 14px', cursor: 'pointer',
                      borderBottom: i < PLACEHOLDERS.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                      transition: 'background 0.1s',
                    }}
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
