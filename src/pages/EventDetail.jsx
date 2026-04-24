import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { updateById, appendRow, deleteById, generateId } from '../api/sheets'
import { ContactStatusBadge } from '../components/StatusBadge'

const PRIMARY = '#06b6d4'
const PRIMARY_DARK = '#0891b2'
const TEXT_PRIMARY = '#1e2d3d'
const TEXT_MUTED = '#94a3b8'
const TEXT_SECONDARY = '#64748b'
const BORDER = '#e8edf2'
const CARD_STYLE = { background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const TASK_STATUSES = ['未着手', '進行中', '完了']

function TaskStatusBadge({ status }) {
  const map = {
    '完了':   { bg: '#dcfce7', color: '#16a34a' },
    '進行中': { bg: '#fef9c3', color: '#ca8a04' },
    '未着手': { bg: '#f1f5f9', color: '#64748b' },
  }
  const s = map[status] || map['未着手']
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function CatBadge({ cat }) {
  const warm = ['告知・集客', 'HP・集客']
  const isWarm = warm.includes(cat)
  return (
    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: isWarm ? '#fef3c7' : '#f1f5f9', color: isWarm ? '#d97706' : '#64748b', fontWeight: 500 }}>
      {cat || '—'}
    </span>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { rows: events } = useSheets('events')
  const { rows: tasks, reload: reloadTasks } = useSheets('tasks')
  const { rows: stakeholders } = useSheets('stakeholders')
  const { rows: eventSH, reload: reloadEventSH } = useSheets('event_stakeholders')
  const { rows: results, reload: reloadResults } = useSheets('results')
  const { rows: formSync, reload: reloadFormSync } = useSheets('form_sync')

  const [activeTab, setActiveTab] = useState('tasks')

  // 申込・実績
  const [editingResult, setEditingResult] = useState(false)
  const [resultForm, setResultForm] = useState({ student_applied: '', company_applied: '', student_actual: '', company_actual: '' })
  const [savingResult, setSavingResult] = useState(false)

  // タスク編集・追加
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskEditForm, setTaskEditForm] = useState({})
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState({ name: '', category: '', start_date: '', due_date: '', assignee: '', status: '未着手', memo: '' })
  const [savingTask, setSavingTask] = useState(false)

  // SH紐づけ
  const [addingSH, setAddingSH] = useState(false)
  const [selectedSHId, setSelectedSHId] = useState('')
  const [savingSH, setSavingSH] = useState(false)

  const event = events.find(e => e.id === id)
  const evTasks = tasks.filter(t => t.event_id === id)
  const evSHIds = eventSH.filter(r => r.event_id === id).map(r => r.stakeholder_id)
  const evStakeholders = stakeholders.filter(s => evSHIds.includes(s.id))
  const evResult = results.find(r => r.event_id === id)
  const today = new Date().toISOString().split('T')[0]
  const unlinkedSH = stakeholders.filter(s => !evSHIds.includes(s.id))

  // フォーム連携: form_syncシートから自動カウント
  const formStudentCount = formSync.filter(r => r.event_id === id && r.type === 'student').length
  const formCompanyCount = formSync.filter(r => r.event_id === id && r.type === 'company').length

  const ganttData = useMemo(() => {
    if (!event?.event_date || evTasks.length === 0) return null
    const eventDate = new Date(event.event_date)
    const start = new Date(eventDate); start.setDate(start.getDate() - 90)
    const end = new Date(eventDate); end.setDate(end.getDate() + 14)
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return { start, end, totalDays, eventDate }
  }, [event, evTasks])

  // ── タスク操作 ──────────────────────────────────────
  const handleTaskStatusChange = async (task, newStatus) => {
    try { await updateById('tasks', task.id, { ...task, status: newStatus }); reloadTasks() }
    catch (e) { alert('更新失敗: ' + e.message) }
  }

  const startEditTask = (task) => {
    setEditingTaskId(task.id)
    setTaskEditForm({ name: task.name, category: task.category, start_date: task.start_date || '', due_date: task.due_date, assignee: task.assignee, status: task.status, memo: task.memo })
  }

  const handleSaveTask = async (task) => {
    setSavingTask(true)
    try { await updateById('tasks', task.id, { ...task, ...taskEditForm }); reloadTasks(); setEditingTaskId(null) }
    catch (e) { alert('更新失敗: ' + e.message) }
    finally { setSavingTask(false) }
  }

  const handleDeleteTask = async (task) => {
    if (!confirm(`「${task.name}」を削除しますか？`)) return
    try { await deleteById('tasks', task.id); reloadTasks() }
    catch (e) { alert('削除失敗: ' + e.message) }
  }

  const handleAddTask = async () => {
    if (!newTaskForm.name) { alert('タスク名を入力してください'); return }
    setSavingTask(true)
    try {
      await appendRow('tasks', [
        generateId(), id, newTaskForm.name, newTaskForm.category,
        newTaskForm.start_date, newTaskForm.due_date,
        newTaskForm.assignee, newTaskForm.status, newTaskForm.memo,
      ])
      reloadTasks()
      setAddingTask(false)
      setNewTaskForm({ name: '', category: '', start_date: '', due_date: '', assignee: '', status: '未着手', memo: '' })
    } catch (e) { alert('追加失敗: ' + e.message) }
    finally { setSavingTask(false) }
  }

  // ── イベント削除 ─────────────────────────────────────
  const handleDeleteEvent = async () => {
    if (!confirm(`「${event?.name}」を削除しますか？`)) return
    try { await deleteById('events', id); navigate('/events') }
    catch (e) { alert('削除失敗: ' + e.message) }
  }

  // ── 申込・実績 ────────────────────────────────────────
  const handleSaveResult = async () => {
    setSavingResult(true)
    try {
      const now = new Date().toISOString()
      if (evResult) {
        await updateById('results', evResult.id, { ...evResult, ...resultForm, recorded_at: now })
      } else {
        await appendRow('results', [generateId(), id, resultForm.student_applied, resultForm.company_applied, resultForm.student_actual, resultForm.company_actual, now])
      }
      reloadResults(); setEditingResult(false)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSavingResult(false) }
  }

  // ── SH紐づけ ─────────────────────────────────────────
  const handleAddSH = async () => {
    if (!selectedSHId) return
    setSavingSH(true)
    try {
      await appendRow('event_stakeholders', [generateId(), id, selectedSHId])
      reloadEventSH(); setAddingSH(false); setSelectedSHId('')
    } catch (e) { alert('紐づけ失敗: ' + e.message) }
    finally { setSavingSH(false) }
  }

  const handleRemoveSH = async (shId) => {
    const link = eventSH.find(r => r.event_id === id && r.stakeholder_id === shId)
    if (!link) return
    if (!confirm('このステークホルダーとの紐づけを解除しますか？')) return
    try { await deleteById('event_stakeholders', link.id); reloadEventSH() }
    catch (e) { alert('解除失敗: ' + e.message) }
  }

  if (!event) {
    return <div style={{ padding: '48px', textAlign: 'center', color: TEXT_MUTED, fontSize: 14 }}>{events.length === 0 ? '読み込み中...' : 'イベントが見つかりません'}</div>
  }

  const completedTasks = evTasks.filter(t => t.status === '完了').length
  const progress = evTasks.length > 0 ? Math.round((completedTasks / evTasks.length) * 100) : 0
  const sortedTasks = [...evTasks].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

  const thStyle = { padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TEXT_MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }
  const btnBase = { padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

      {/* ── Top Bar ─────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 36px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/events')}
          style={{ fontSize: 13, color: PRIMARY, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← イベント一覧へ戻る
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate(`/events/${id}/edit`)}
            style={{ ...btnBase, background: PRIMARY, color: '#fff', border: 'none' }}>
            編集
          </button>
          <button onClick={handleDeleteEvent}
            style={{ ...btnBase, border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444' }}>
            削除
          </button>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────── */}
      <div style={{ padding: '32px 36px' }}>

        {/* イベントヘッダー */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[event.big_cat, event.mid_cat, event.small_cat].filter(Boolean).map((tag, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: '#e0f7fa', color: '#0891b2', fontWeight: 500, border: '1px solid #b2ebf2' }}>
                {tag}
              </span>
            ))}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '-0.02em', lineHeight: 1.4 }}>
            {event.name}
          </h1>
        </div>

        {/* 統計カード 4列 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: '開催日', value: formatDate(event.event_date) },
            { label: '会場',   value: event.venue || '—' },
            { label: '学生目標', value: event.student_goal ? `${event.student_goal}名` : '—' },
            { label: '企業目標', value: event.company_goal ? `${event.company_goal}社` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ ...CARD_STYLE, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* 申込実績 + タスク進捗 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>

          {/* 申込・参加実績 */}
          <div style={{ ...CARD_STYLE, padding: '22px 26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>申込・参加実績</div>
              <button
                style={{ fontSize: 12, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => {
                  setResultForm(evResult
                    ? { student_applied: evResult.student_applied, company_applied: evResult.company_applied, student_actual: evResult.student_actual, company_actual: evResult.company_actual }
                    : resultForm)
                  setEditingResult(!editingResult)
                }}>
                {editingResult ? 'キャンセル' : '編集'}
              </button>
            </div>
            {/* フォーム自動カウント */}
            {(formStudentCount > 0 || formCompanyCount > 0) && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>フォーム自動取得</span>
                <span style={{ fontSize: 12, color: '#15803d' }}>学生申込: <strong>{formStudentCount}件</strong></span>
                <span style={{ fontSize: 12, color: '#15803d' }}>企業申込: <strong>{formCompanyCount}件</strong></span>
                <button onClick={reloadFormSync} style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', background: 'none', border: '1px solid #86efac', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
                  更新
                </button>
              </div>
            )}

            {editingResult ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {['student_applied', 'company_applied', 'student_actual', 'company_actual'].map((f, i) => (
                    <div key={f}>
                      <label className="form-label">{['学生申込（手動）', '企業申込（手動）', '学生参加実数', '企業参加実数'][i]}</label>
                      <input type="number" className="form-input" value={resultForm[f]} min="0"
                        onChange={e => setResultForm(p => ({ ...p, [f]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: 12, padding: '6px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer' }}
                  onClick={handleSaveResult} disabled={savingResult}>
                  {savingResult ? '保存中...' : '保存'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  ['学生申込', formStudentCount > 0 ? formStudentCount : evResult?.student_applied, formStudentCount > 0],
                  ['企業申込', formCompanyCount > 0 ? formCompanyCount : evResult?.company_applied, formCompanyCount > 0],
                  ['学生参加実数', evResult?.student_actual, false],
                  ['企業参加実数', evResult?.company_actual, false],
                ].map(([label, value, isAuto]) => (
                  <div key={label} style={{ textAlign: 'center', padding: '12px 0', background: '#f8fafc', borderRadius: 10, position: 'relative' }}>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: TEXT_PRIMARY }}>{value || '—'}</div>
                    {isAuto && <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>自動取得</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* タスク進捗 */}
          <div style={{ ...CARD_STYLE, padding: '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>タスク進捗</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: PRIMARY, letterSpacing: '-0.03em', marginBottom: 12 }}>{progress}%</div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${PRIMARY_DARK}, ${PRIMARY})`, borderRadius: 99, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>{completedTasks} / {evTasks.length} タスク完了</div>
          </div>
        </div>

        {/* タブ + コンテンツカード */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>

          {/* タブバー */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '0 24px' }}>
            {[
              { key: 'tasks',        label: `タスク (${evTasks.length})` },
              { key: 'gantt',        label: 'ガントチャート' },
              { key: 'stakeholders', label: `ステークホルダー (${evStakeholders.length})` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 18px', fontSize: 13,
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  color: activeTab === tab.key ? PRIMARY : TEXT_MUTED,
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {tab.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              {activeTab === 'tasks' && (
                <button
                  style={{ padding: '8px 18px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => { setAddingTask(true); setEditingTaskId(null) }}>
                  + タスク追加
                </button>
              )}
              {activeTab === 'stakeholders' && (
                <button
                  style={{ padding: '8px 18px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setAddingSH(true)}>
                  + ステークホルダーを紐づける
                </button>
              )}
            </div>
          </div>

          {/* ── タスクタブ ─────────────────────────── */}
          {activeTab === 'tasks' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  {['タスク名', 'カテゴリ', '開始日', '期日', 'ステータス', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 新規追加行 */}
                {addingTask && (
                  <tr style={{ borderTop: '1px solid #f8fafc', background: '#f0fdf4' }}>
                    <td style={{ padding: '10px 16px' }}><input className="form-input text-xs py-1" placeholder="タスク名 *" value={newTaskForm.name} onChange={e => setNewTaskForm(p => ({ ...p, name: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}><input className="form-input text-xs py-1" placeholder="カテゴリ" value={newTaskForm.category} onChange={e => setNewTaskForm(p => ({ ...p, category: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={newTaskForm.start_date} onChange={e => setNewTaskForm(p => ({ ...p, start_date: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={newTaskForm.due_date} onChange={e => setNewTaskForm(p => ({ ...p, due_date: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <select className="form-select text-xs py-1" value={newTaskForm.status} onChange={e => setNewTaskForm(p => ({ ...p, status: e.target.value }))}>
                        {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          onClick={handleAddTask} disabled={savingTask}>保存</button>
                        <button style={{ fontSize: 11, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => setAddingTask(false)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )}

                {evTasks.length === 0 && !addingTask ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 13, padding: '40px 0' }}>タスクがありません</td></tr>
                ) : (
                  sortedTasks.map(t => {
                    const isOverdue = t.status !== '完了' && t.due_date && t.due_date < today
                    const isEditing = editingTaskId === t.id
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid #f8fafc', background: isEditing ? '#eff6ff' : isOverdue ? '#fff5f5' : 'transparent' }}>
                        {isEditing ? (
                          <>
                            <td style={{ padding: '10px 16px' }}><input className="form-input text-xs py-1" value={taskEditForm.name} onChange={e => setTaskEditForm(p => ({ ...p, name: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}><input className="form-input text-xs py-1" value={taskEditForm.category} onChange={e => setTaskEditForm(p => ({ ...p, category: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={taskEditForm.start_date} onChange={e => setTaskEditForm(p => ({ ...p, start_date: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={taskEditForm.due_date} onChange={e => setTaskEditForm(p => ({ ...p, due_date: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}>
                              <select className="form-select text-xs py-1" value={taskEditForm.status} onChange={e => setTaskEditForm(p => ({ ...p, status: e.target.value }))}>
                                {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  onClick={() => handleSaveTask(t)} disabled={savingTask}>保存</button>
                                <button style={{ fontSize: 11, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
                                  onClick={() => setEditingTaskId(null)}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '13px 20px', fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>{t.name}</td>
                            <td style={{ padding: '13px 20px' }}><CatBadge cat={t.category} /></td>
                            <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{formatDate(t.start_date)}</td>
                            <td style={{ padding: '13px 20px', fontSize: 12, color: isOverdue ? '#ef4444' : TEXT_SECONDARY, fontWeight: isOverdue ? 700 : 400 }}>{formatDate(t.due_date)}</td>
                            <td style={{ padding: '13px 20px' }}>
                              <select
                                value={t.status}
                                onChange={e => handleTaskStatusChange(t, e.target.value)}
                                style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 6px', background: '#fff', cursor: 'pointer', color: TEXT_PRIMARY }}>
                                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <button style={{ fontSize: 11, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                                  onClick={() => { startEditTask(t); setAddingTask(false) }}>編集</button>
                                <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                  onClick={() => handleDeleteTask(t)}>削除</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ── ガントチャートタブ ─────────────────── */}
          {activeTab === 'gantt' && (
            <div style={{ padding: '24px 28px', overflowX: 'auto' }}>
              {!ganttData ? (
                <p style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 13, padding: '40px 0' }}>開催日またはタスクが未設定です</p>
              ) : (
                <GanttChart tasks={evTasks} ganttData={ganttData} today={today} />
              )}
            </div>
          )}

          {/* ── ステークホルダータブ ──────────────── */}
          {activeTab === 'stakeholders' && (
            <>
              {addingSH && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">ステークホルダーを選択</label>
                    <select className="form-select" value={selectedSHId} onChange={e => setSelectedSHId(e.target.value)}>
                      <option value="">選択...</option>
                      {unlinkedSH.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.contact_name ? ` (${s.contact_name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button style={{ padding: '8px 18px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    onClick={handleAddSH} disabled={savingSH || !selectedSHId}>
                    {savingSH ? '追加中...' : '追加'}
                  </button>
                  <button style={{ fontSize: 13, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => { setAddingSH(false); setSelectedSHId('') }}>キャンセル</button>
                </div>
              )}
              {evStakeholders.length === 0 ? (
                <p style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 13, padding: '40px 0' }}>紐づくステークホルダーがありません</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafbfc' }}>
                      {['名称', '種別', '担当者', '連絡状況', '次アクション期限', ''].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evStakeholders.map(s => (
                      <tr key={s.id} style={{ borderTop: '1px solid #f8fafc' }}>
                        <td style={{ padding: '13px 20px', fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{s.type}</td>
                        <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{s.contact_name || '—'}</td>
                        <td style={{ padding: '13px 20px' }}><ContactStatusBadge status={s.contact_status} /></td>
                        <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{formatDate(s.next_action_date)}</td>
                        <td style={{ padding: '13px 20px' }}>
                          <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => handleRemoveSH(s.id)}>紐づけ解除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function GanttChart({ tasks, ganttData, today }) {
  const { start, end, totalDays, eventDate } = ganttData

  const getPos = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const diff = Math.ceil((d - start) / (1000 * 60 * 60 * 24))
    return Math.max(0, Math.min(100, (diff / totalDays) * 100))
  }

  const todayPos = getPos(today)
  const eventPos = getPos(eventDate.toISOString().split('T')[0])

  const monthLabels = []
  const cur = new Date(start)
  while (cur <= end) {
    monthLabels.push({ label: `${cur.getMonth() + 1}月`, pos: getPos(cur.toISOString().split('T')[0]) })
    cur.setMonth(cur.getMonth() + 1); cur.setDate(1)
  }

  const statusColor = { '未着手': '#d1d5db', '進行中': '#3b82f6', '完了': PRIMARY, '期限超過': '#ef4444' }
  const PRIMARY = '#06b6d4'

  return (
    <div>
      <div style={{ position: 'relative', height: 24, marginBottom: 4 }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{ position: 'absolute', fontSize: 11, color: '#94a3b8', transform: 'translateX(-50%)', left: `${m.pos}%` }}>{m.label}</span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        {todayPos !== null && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#f87171', zIndex: 10, left: `${todayPos}%` }} title="今日" />}
        {eventPos !== null && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: PRIMARY, zIndex: 10, left: `${eventPos}%` }} title="開催日" />}
        {[...tasks].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(t => {
          const pos = getPos(t.due_date)
          if (pos === null) return null
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</div>
              <div style={{ flex: 1, position: 'relative', height: 20, background: '#f1f5f9', borderRadius: 4 }}>
                <div style={{ position: 'absolute', top: 4, height: 12, width: 12, borderRadius: 3, left: `${pos}%`, background: statusColor[t.status] || '#d1d5db', transform: 'translateX(-50%)' }} title={`${t.name}: ${t.due_date}`} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 11, color: '#94a3b8' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, borderRadius: 2, display: 'inline-block', background: PRIMARY }} />完了</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, borderRadius: 2, display: 'inline-block', background: '#3b82f6' }} />進行中</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, borderRadius: 2, display: 'inline-block', background: '#d1d5db' }} />未着手</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 12, borderRadius: 1, display: 'inline-block', background: '#f87171' }} />今日</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 12, borderRadius: 1, display: 'inline-block', background: PRIMARY }} />開催日</span>
      </div>
    </div>
  )
}
