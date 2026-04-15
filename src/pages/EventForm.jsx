import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { getSheet, appendRow, updateById, generateId } from '../api/sheets'
import { CATEGORIES } from '../constants/categories'
import { getTemplateBySmallCat, calcDueDate } from '../constants/taskTemplates'

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
  sheets_url: '',
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

  // 中分類の選択肢
  const midCats = useMemo(() => {
    const big = CATEGORIES.find(b => b.name === form.big_cat)
    return big?.mid || []
  }, [form.big_cat])

  // 小分類の選択肢
  const smallCats = useMemo(() => {
    const big = CATEGORIES.find(b => b.name === form.big_cat)
    const mid = big?.mid.find(m => m.name === form.mid_cat)
    return mid?.small || []
  }, [form.big_cat, form.mid_cat])

  // 小分類・開催日が変わったらタスクテンプレートを展開
  useEffect(() => {
    if (!form.small_cat || isEdit) return

    // スプレッドシートのテンプレートを優先、なければ定数を使用
    const sheetTemplates = templates.filter(t => t.small_cat === form.small_cat)
    const templateList = sheetTemplates.length > 0
      ? sheetTemplates.map(t => ({
          task_name: t.task_name,
          category: t.category,
          days_before: Number(t.days_before),
        }))
      : getTemplateBySmallCat(form.small_cat)

    const drafts = templateList.map((t, i) => ({
      _key: `${form.small_cat}-${i}`,
      name: t.task_name,
      category: t.category,
      days_before: t.days_before,
      due_date: calcDueDate(form.event_date, t.days_before),
      assignee: '',
      status: '未着手',
      priority: '中',
      memo: '',
    }))
    setTaskDrafts(drafts)
  }, [form.small_cat, form.event_date, templates, isEdit])

  // 開催日変更時にタスク期日を再計算
  useEffect(() => {
    if (!form.event_date) return
    setTaskDrafts(prev => prev.map(t => ({
      ...t,
      due_date: calcDueDate(form.event_date, t.days_before),
    })))
  }, [form.event_date])

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // 大分類変更時に中・小をリセット
      if (field === 'big_cat') { next.mid_cat = ''; next.small_cat = '' }
      if (field === 'mid_cat') { next.small_cat = '' }
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
      due_date: form.event_date || '',
      assignee: '',
      status: '未着手',
      priority: '中',
      memo: '',
    }])
  }

  const handleRemoveTask = (key) => {
    setTaskDrafts(prev => prev.filter(t => t._key !== key))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.big_cat || !form.mid_cat || !form.small_cat || !form.event_date) {
      setError('必須項目（イベント名・分類・開催日）を入力してください')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const eventId = isEdit ? id : generateId()
      const now = new Date().toISOString()

      const eventRow = [
        eventId,
        form.name,
        form.big_cat,
        form.mid_cat,
        form.small_cat,
        form.event_date,
        form.venue,
        form.student_goal,
        form.company_goal,
        form.status || '計画中',
        form.sheets_url,
        isEdit ? form.created_at : now,
      ]

      if (isEdit) {
        await updateById('events', id, {
          id: eventId,
          name: form.name,
          big_cat: form.big_cat,
          mid_cat: form.mid_cat,
          small_cat: form.small_cat,
          event_date: form.event_date,
          venue: form.venue,
          student_goal: form.student_goal,
          company_goal: form.company_goal,
          status: form.status,
          sheets_url: form.sheets_url,
          created_at: form.created_at,
        })
      } else {
        await appendRow('events', eventRow)

        // タスクを一括登録
        for (const t of taskDrafts) {
          if (!t.name) continue
          const taskRow = [
            generateId(),
            eventId,
            t.name,
            t.category,
            t.due_date,
            t.assignee,
            t.status,
            t.priority,
            t.memo,
          ]
          await appendRow('tasks', taskRow)
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
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {isEdit ? 'イベント編集' : 'イベント新規登録'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報 */}
        <section className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">基本情報</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">イベント名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="例: 〇〇大学向け業界研究セミナー2026春"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">大分類 <span className="text-red-500">*</span></label>
                <select
                  className="form-select"
                  value={form.big_cat}
                  onChange={e => handleChange('big_cat', e.target.value)}
                >
                  <option value="">選択...</option>
                  {CATEGORIES.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">中分類 <span className="text-red-500">*</span></label>
                <select
                  className="form-select"
                  value={form.mid_cat}
                  onChange={e => handleChange('mid_cat', e.target.value)}
                  disabled={!form.big_cat}
                >
                  <option value="">選択...</option>
                  {midCats.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">小分類 <span className="text-red-500">*</span></label>
                <select
                  className="form-select"
                  value={form.small_cat}
                  onChange={e => handleChange('small_cat', e.target.value)}
                  disabled={!form.mid_cat}
                >
                  <option value="">選択...</option>
                  {smallCats.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">開催日 <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={form.event_date}
                  onChange={e => handleChange('event_date', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">会場</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.venue}
                  onChange={e => handleChange('venue', e.target.value)}
                  placeholder="例: 〇〇大学 A棟301号室"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">学生参加目標数</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.student_goal}
                  onChange={e => handleChange('student_goal', e.target.value)}
                  min="0"
                />
              </div>
              <div>
                <label className="form-label">企業参加目標数</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.company_goal}
                  onChange={e => handleChange('company_goal', e.target.value)}
                  min="0"
                />
              </div>
            </div>
            <div>
              <label className="form-label">申込フォーム / 集計シートURL</label>
              <input
                type="url"
                className="form-input"
                value={form.sheets_url}
                onChange={e => handleChange('sheets_url', e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
              />
            </div>
            {isEdit && (
              <div>
                <label className="form-label">ステータス</label>
                <select
                  className="form-select w-40"
                  value={form.status}
                  onChange={e => handleChange('status', e.target.value)}
                >
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
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    （「{form.small_cat}」のテンプレートから自動展開）
                  </span>
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
                    <tr style={{ background: '#262526' }} className="text-white">
                      <th className="text-left px-3 py-2 font-medium w-48">タスク名</th>
                      <th className="text-left px-3 py-2 font-medium w-28">カテゴリ</th>
                      <th className="text-left px-3 py-2 font-medium w-32">期日</th>
                      <th className="text-left px-3 py-2 font-medium w-24">優先度</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskDrafts.map(t => (
                      <tr key={t._key} className="border-b border-gray-50">
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            className="form-input text-xs py-1"
                            value={t.name}
                            onChange={e => handleTaskChange(t._key, 'name', e.target.value)}
                            placeholder="タスク名"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            className="form-input text-xs py-1"
                            value={t.category}
                            onChange={e => handleTaskChange(t._key, 'category', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="date"
                            className="form-input text-xs py-1"
                            value={t.due_date}
                            onChange={e => handleTaskChange(t._key, 'due_date', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            className="form-select text-xs py-1"
                            value={t.priority}
                            onChange={e => handleTaskChange(t._key, 'priority', e.target.value)}
                          >
                            <option>高</option>
                            <option>中</option>
                            <option>低</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            className="text-gray-300 hover:text-red-400 text-base"
                            onClick={() => handleRemoveTask(t._key)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded text-sm font-semibold text-gray-900 hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: '#29e6d3' }}
          >
            {saving ? '保存中...' : isEdit ? '更新する' : '登録する'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
