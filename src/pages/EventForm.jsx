import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'
import { CATEGORIES, SMALL_CAT_MAP, STANDALONE_SMALL_CATS } from '../constants/categories'
import { getTemplateBySmallCat, calcDueDate, calcStartDate } from '../constants/taskTemplates'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import Btn from '../components/Btn'

const EMPTY_EVENT = {
  name: '',
  big_cat: '',
  mid_cat: '',
  small_cat: '',
  event_date: '',
  venue: '',
  student_goal: '',
  company_goal: '',
  status: '計画中',
  student_form_url: '',
  company_form_url: '',
  portal_company_url: '',
  portal_student_url: '',
  parent_id: '',
}

export default function EventForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const { rows: events } = useSheets('events')
  const { rows: templates } = useSheets('task_templates')

  const [form, setForm] = useState(EMPTY_EVENT)
  const [taskDrafts, setTaskDrafts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // 編集モード: 既存データをフォームにセット
  useEffect(() => {
    if (isEdit && events.length > 0) {
      const ev = events.find(e => e.id === id)
      if (ev) setForm({ ...EMPTY_EVENT, ...ev })
    }
  }, [isEdit, id, events])

  // 中分類の選択肢（大分類から絞る）
  const midCats = useMemo(() => {
    const big = CATEGORIES.find(b => b.name === form.big_cat)
    return big?.mid || []
  }, [form.big_cat])

  // 小分類の選択肢（中分類から絞る）
  const smallCats = useMemo(() => {
    const big = CATEGORIES.find(b => b.name === form.big_cat)
    const mid = big?.mid.find(m => m.name === form.mid_cat)
    return mid?.small || []
  }, [form.big_cat, form.mid_cat])

  // 小分類・開催日が変わったらタスクテンプレートを展開
  useEffect(() => {
    if (!form.small_cat || isEdit) return
    const sheetTemplates = templates.filter(t => t.small_cat === form.small_cat)
    const templateList = sheetTemplates.length > 0
      ? sheetTemplates.map(t => ({
          task_name: t.task_name,
          category: t.category,
          days_before: Number(t.days_before),
        }))
      : getTemplateBySmallCat(form.small_cat)

    const drafts = templateList.map((t, i) => {
      const due = calcDueDate(form.event_date, t.days_before)
      return {
        _key: `${form.small_cat}-${i}`,
        name: t.task_name,
        category: t.category,
        days_before: t.days_before,
        start_date: calcStartDate(due),
        due_date: due,
        assignee: '',
        status: '未着手',
        memo: '',
      }
    })
    setTaskDrafts(drafts)
  }, [form.small_cat, templates, isEdit])

  // 開催日変更時にタスク期日・開始日を再計算（通年は除く）
  useEffect(() => {
    if (!form.event_date || form.event_date === '通年') return
    setTaskDrafts(prev => prev.map(t => {
      const due = calcDueDate(form.event_date, t.days_before)
      return { ...t, due_date: due, start_date: calcStartDate(due) }
    }))
  }, [form.event_date])

  // 親イベント候補（自分以外・parent_idを持たないイベント）
  const parentCandidates = useMemo(() =>
    events.filter(e => !e.parent_id && e.id !== id)
  , [events, id])

  const parentEvent = useMemo(() =>
    form.parent_id ? events.find(e => e.id === form.parent_id) : null
  , [events, form.parent_id])

  const isChildEvent = !!form.parent_id
  const isParentEvent = isEdit && events.some(e => e.parent_id === id)

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'big_cat') { next.mid_cat = ''; next.small_cat = '' }
      if (field === 'mid_cat') { next.small_cat = '' }
      if (field === 'small_cat' && value) {
        if (STANDALONE_SMALL_CATS.includes(value)) {
          next.big_cat = ''; next.mid_cat = ''
        } else {
          const match = SMALL_CAT_MAP[value]
          if (match) { next.big_cat = match.bigName; next.mid_cat = match.midName }
        }
      }
      // 親イベント選択時: 分類を親から自動入力
      if (field === 'parent_id' && value) {
        const parent = events.find(e => e.id === value)
        if (parent) {
          next.big_cat   = parent.big_cat   || prev.big_cat
          next.mid_cat   = parent.mid_cat   || prev.mid_cat
          next.small_cat = parent.small_cat || prev.small_cat
        }
      }
      if (field === 'parent_id' && !value) {
        // 親を外した場合はリセット
        next.big_cat = ''; next.mid_cat = ''; next.small_cat = ''
      }
      return next
    })
  }

  const handleTaskChange = (key, field, value) => {
    setTaskDrafts(prev => prev.map(t =>
      t._key === key ? { ...t, [field]: value } : t
    ))
  }

  const handleAddTask = () => {
    setTaskDrafts(prev => [...prev, {
      _key: `manual-${Date.now()}`,
      name: '',
      category: '',
      days_before: 0,
      start_date: '',
      due_date: form.event_date || '',
      assignee: '',
      status: '未着手',
      memo: '',
    }])
  }

  const handleRemoveTask = (key) => {
    setTaskDrafts(prev => prev.filter(t => t._key !== key))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const catOk = form.small_cat && (STANDALONE_SMALL_CATS.includes(form.small_cat) || (form.big_cat && form.mid_cat))
    if (!form.name || !catOk || !form.event_date) {
      setError('必須項目（イベント名・分類・開催日）を入力してください')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const eventId = isEdit ? id : generateId()
      const now = new Date().toISOString()

      if (isEdit) {
        await updateById('events', id, {
          id: eventId,
          parent_id: form.parent_id,
          name: form.name,
          big_cat: form.big_cat,
          mid_cat: form.mid_cat,
          small_cat: form.small_cat,
          event_date: form.event_date,
          venue: form.venue,
          student_goal: form.student_goal,
          company_goal: form.company_goal,
          status: form.status,
          student_form_url: form.student_form_url,
          company_form_url: form.company_form_url,
          portal_company_url: form.portal_company_url,
          portal_student_url: form.portal_student_url,
          created_at: form.created_at,
        })
      } else {
        await appendRow('events', {
          id: eventId, name: form.name, big_cat: form.big_cat, mid_cat: form.mid_cat,
          small_cat: form.small_cat, event_date: form.event_date, venue: form.venue,
          student_goal: form.student_goal, company_goal: form.company_goal,
          status: form.status || '計画中', student_form_url: form.student_form_url,
          company_form_url: form.company_form_url, portal_company_url: form.portal_company_url,
          portal_student_url: form.portal_student_url, parent_id: form.parent_id,
        })
        for (const t of taskDrafts) {
          if (!t.name) continue
          await appendRow('tasks', {
            id: generateId(), event_id: eventId, name: t.name, category: t.category,
            start_date: t.start_date, due_date: t.due_date, assignee: t.assignee,
            status: t.status, memo: t.memo,
          })
        }
      }

      navigate(`/events/${eventId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}>
          {Icon.chevL()} 戻る
        </button>
        <span>{isEdit ? 'イベント編集' : 'イベント新規登録'}</span>
      </TopBar>
    <div className="p-6 max-w-3xl">

      {error && <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">イベント名 <span className="text-red-500">*</span></label>
              <input type="text" className="form-input" value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="例: 〇〇大学向け業界研究セミナー2026春" />
            </div>

            {/* 親イベント選択（小イベントとして登録する場合） */}
            <div>
              <label className="form-label">親イベント</label>
              <select className="form-select" value={form.parent_id}
                onChange={e => handleChange('parent_id', e.target.value)}>
                <option value="">（なし — 単独イベントまたは親イベントとして登録）</option>
                {parentCandidates.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.small_cat ? `[${ev.small_cat}] ` : ''}{ev.name}
                  </option>
                ))}
              </select>
              {parentEvent && (
                <p className="text-xs text-gray-400 mt-1">
                  親: {parentEvent.big_cat}{parentEvent.mid_cat ? ` › ${parentEvent.mid_cat}` : ''} › {parentEvent.small_cat} › {parentEvent.name}
                </p>
              )}
              {!parentEvent && (
                <p className="text-xs text-gray-400 mt-1">
                  親イベントを選択すると分類が自動入力され、小イベントとして紐づけられます
                </p>
              )}
            </div>

            {/* 分類選択：大→中→小、または小から逆引き */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">大分類 <span className="text-red-500">*</span></label>
                <select className="form-select" value={form.big_cat}
                  onChange={e => handleChange('big_cat', e.target.value)}>
                  <option value="">選択...</option>
                  {CATEGORIES.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">中分類 <span className="text-red-500">*</span></label>
                <select className="form-select" value={form.mid_cat}
                  onChange={e => handleChange('mid_cat', e.target.value)}
                  disabled={!form.big_cat}>
                  <option value="">選択...</option>
                  {midCats.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">小分類 <span className="text-red-500">*</span></label>
                <select className="form-select" value={form.small_cat}
                  onChange={e => handleChange('small_cat', e.target.value)}>
                  <option value="">選択...</option>
                  {(form.mid_cat ? smallCats : CATEGORIES.flatMap(b => b.mid.flatMap(m => m.small)))
                    .map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  <optgroup label="─ その他 ─">
                    {STANDALONE_SMALL_CATS.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
              </div>
            </div>
            {/* 小分類選択時に大・中を自動表示するヒント */}
            {form.small_cat && (
              <p className="text-xs text-gray-400">
                {form.big_cat} › {form.mid_cat} › {form.small_cat}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">開催日 <span className="text-red-500">*</span></label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {form.event_date !== '通年' && (
                    <input type="date" className="form-input" value={form.event_date}
                      onChange={e => handleChange('event_date', e.target.value)} />
                  )}
                  {form.event_date === '通年' && (
                    <div className="form-input" style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>通年</div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input type="checkbox"
                      checked={form.event_date === '通年'}
                      onChange={e => handleChange('event_date', e.target.checked ? '通年' : '')} />
                    通年
                  </label>
                </div>
              </div>
              <div>
                <label className="form-label">会場</label>
                <input type="text" className="form-input" value={form.venue}
                  onChange={e => handleChange('venue', e.target.value)}
                  placeholder="例: 〇〇大学 A棟301号室" />
              </div>
            </div>
            {!isChildEvent && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">学生参加目標数</label>
                  <input type="number" className="form-input" value={form.student_goal}
                    onChange={e => handleChange('student_goal', e.target.value)} min="0" />
                </div>
                <div>
                  <label className="form-label">企業参加目標数</label>
                  <input type="number" className="form-input" value={form.company_goal}
                    onChange={e => handleChange('company_goal', e.target.value)} min="0" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">学生申込フォーム 回答スプレッドシートURL</label>
                <input type="url" className="form-input" value={form.student_form_url}
                  onChange={e => handleChange('student_form_url', e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/..." />
              </div>
              <div>
                <label className="form-label">企業申込フォーム 回答スプレッドシートURL</label>
                <input type="url" className="form-input" value={form.company_form_url}
                  onChange={e => handleChange('company_form_url', e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">企業向けポータルサイト URL</label>
                <input type="url" className="form-input" value={form.portal_company_url}
                  onChange={e => handleChange('portal_company_url', e.target.value)}
                  placeholder="https://..." />
              </div>
              <div>
                <label className="form-label">学生向けポータルサイト URL</label>
                <input type="url" className="form-input" value={form.portal_student_url}
                  onChange={e => handleChange('portal_student_url', e.target.value)}
                  placeholder="https://..." />
              </div>
            </div>
            {isEdit && !isParentEvent && (
              <div>
                <label className="form-label">ステータス</label>
                <select className="form-select w-40" value={form.status}
                  onChange={e => handleChange('status', e.target.value)}>
                  {['計画中', '順調', '注意', '要対応', '完了'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* タスク（新規登録時のみ） */}
        {!isEdit && (
          <section className="bg-white rounded-lg border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h2 className="text-sm font-semibold text-gray-700">
                タスク
                {form.small_cat && taskDrafts.length > 0 && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">（「{form.small_cat}」テンプレートから自動展開）</span>
                )}
              </h2>
              <button type="button" className="btn-secondary text-xs py-1.5" onClick={handleAddTask}>
                + タスク追加
              </button>
            </div>

            {taskDrafts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {form.small_cat ? 'テンプレートが未登録です。手動で追加してください。' : '小分類を選択するとテンプレートが自動展開されます'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.borderSoft}` }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>タスク名</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase', width: 110 }}>カテゴリ</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase', width: 128 }}>開始日</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase', width: 128 }}>期日</th>
                      <th style={{ padding: '8px 12px', width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskDrafts.map(t => (
                      <tr key={t._key} className="border-b border-gray-50">
                        <td className="px-3 py-1.5">
                          <input type="text" className="form-input text-xs py-1" value={t.name}
                            onChange={e => handleTaskChange(t._key, 'name', e.target.value)} placeholder="タスク名" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="text" className="form-input text-xs py-1" value={t.category}
                            onChange={e => handleTaskChange(t._key, 'category', e.target.value)} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="date" className="form-input text-xs py-1" value={t.start_date}
                            onChange={e => handleTaskChange(t._key, 'start_date', e.target.value)} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input type="date" className="form-input text-xs py-1" value={t.due_date}
                            onChange={e => handleTaskChange(t._key, 'due_date', e.target.value)} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button type="button" className="text-gray-300 hover:text-red-400 text-base"
                            onClick={() => handleRemoveTask(t._key)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn kind="primary" style={{ opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : isEdit ? '更新する' : '登録する'}
          </Btn>
          <Btn kind="ghost" type="button" onClick={() => navigate(-1)}>キャンセル</Btn>
        </div>
      </form>
    </div>
    </div>
  )
}
