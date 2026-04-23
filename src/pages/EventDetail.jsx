import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { updateById, appendRow, deleteById, generateId } from '../api/sheets'
import { EventStatusBadge, ContactStatusBadge } from '../components/StatusBadge'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const TASK_STATUSES = ['未着手', '進行中', '完了']

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { rows: events } = useSheets('events')
  const { rows: tasks, reload: reloadTasks } = useSheets('tasks')
  const { rows: stakeholders } = useSheets('stakeholders')
  const { rows: eventSH, reload: reloadEventSH } = useSheets('event_stakeholders')
  const { rows: results, reload: reloadResults } = useSheets('results')

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

  // 未紐づけのSH
  const unlinkedSH = stakeholders.filter(s => !evSHIds.includes(s.id))

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
    return <div className="p-6 text-center text-gray-400 text-sm">{events.length === 0 ? '読み込み中...' : 'イベントが見つかりません'}</div>
  }

  const completedTasks = evTasks.filter(t => t.status === '完了').length
  const progress = evTasks.length > 0 ? Math.round((completedTasks / evTasks.length) * 100) : 0

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <button className="text-sm text-gray-500 hover:text-gray-700 mb-2 block" onClick={() => navigate('/events')}>
            ← イベント一覧へ戻る
          </button>
          <h1 className="text-xl font-bold text-gray-800">{event.name}</h1>
          <p className="text-xs text-gray-400 mt-1">{event.big_cat} › {event.mid_cat} › {event.small_cat}</p>
        </div>
        <div className="flex items-center gap-2">
          <EventStatusBadge status={event.status} />
          <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => navigate(`/events/${id}/edit`)}>編集</button>
          <button className="text-xs py-1.5 px-3 rounded border border-red-200 text-red-500 hover:bg-red-50" onClick={handleDeleteEvent}>削除</button>
        </div>
      </div>

      {/* 概要パネル */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <InfoCard label="開催日" value={formatDate(event.event_date)} />
        <InfoCard label="会場" value={event.venue || '—'} />
        <InfoCard label="学生目標" value={event.student_goal ? `${event.student_goal}名` : '—'} />
        <InfoCard label="企業目標" value={event.company_goal ? `${event.company_goal}社` : '—'} />
      </div>

      {/* 申込・参加実績 */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">申込・参加実績</h2>
          <button className="text-xs hover:underline" style={{ color: '#29e6d3' }}
            onClick={() => { setResultForm(evResult ? { student_applied: evResult.student_applied, company_applied: evResult.company_applied, student_actual: evResult.student_actual, company_actual: evResult.company_actual } : resultForm); setEditingResult(!editingResult) }}>
            {editingResult ? 'キャンセル' : '編集'}
          </button>
        </div>
        {editingResult ? (
          <div className="grid grid-cols-4 gap-3">
            {['student_applied', 'company_applied', 'student_actual', 'company_actual'].map((f, i) => (
              <div key={f}>
                <label className="form-label">{['学生申込', '企業申込', '学生参加実数', '企業参加実数'][i]}</label>
                <input type="number" className="form-input" value={resultForm[f]} min="0"
                  onChange={e => setResultForm(p => ({ ...p, [f]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-4">
              <button className="px-4 py-1.5 rounded text-sm font-semibold text-gray-900 disabled:opacity-50"
                style={{ background: '#29e6d3' }} onClick={handleSaveResult} disabled={savingResult}>
                {savingResult ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {[['学生申込', evResult?.student_applied], ['企業申込', evResult?.company_applied], ['学生参加実数', evResult?.student_actual], ['企業参加実数', evResult?.company_actual]].map(([label, value]) => (
              <div key={label} className="text-center">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-2xl font-bold text-gray-700">{value || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* タスク進捗バー */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>タスク進捗</span>
          <span>{completedTasks} / {evTasks.length} 完了 ({progress}%)</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: '#29e6d3' }} />
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 mb-4">
        {[
          { key: 'tasks', label: `タスク (${evTasks.length})` },
          { key: 'gantt', label: 'ガントチャート' },
          { key: 'stakeholders', label: `ステークホルダー (${evStakeholders.length})` },
        ].map(tab => (
          <button key={tab.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-[#29e6d3] text-gray-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── タスクタブ ─────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-lg border border-gray-100">
          <div className="flex justify-end px-4 py-2 border-b border-gray-100">
            <button className="text-xs px-3 py-1.5 rounded font-semibold text-gray-900 hover:opacity-90"
              style={{ background: '#29e6d3' }}
              onClick={() => { setAddingTask(true); setEditingTaskId(null) }}>
              + タスク追加
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#262526' }} className="text-white text-xs">
                <th className="text-left px-4 py-2.5">タスク名</th>
                <th className="text-left px-4 py-2.5">カテゴリ</th>
                <th className="text-left px-4 py-2.5">開始日</th>
                <th className="text-left px-4 py-2.5">期日</th>
                <th className="text-left px-4 py-2.5">ステータス</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {/* 新規追加行 */}
              {addingTask && (
                <tr className="border-b border-gray-100 bg-green-50">
                  <td className="px-3 py-1.5"><input className="form-input text-xs py-1" placeholder="タスク名 *" value={newTaskForm.name} onChange={e => setNewTaskForm(p => ({ ...p, name: e.target.value }))} /></td>
                  <td className="px-3 py-1.5"><input className="form-input text-xs py-1" placeholder="カテゴリ" value={newTaskForm.category} onChange={e => setNewTaskForm(p => ({ ...p, category: e.target.value }))} /></td>
                  <td className="px-3 py-1.5"><input type="date" className="form-input text-xs py-1" value={newTaskForm.start_date} onChange={e => setNewTaskForm(p => ({ ...p, start_date: e.target.value }))} /></td>
                  <td className="px-3 py-1.5"><input type="date" className="form-input text-xs py-1" value={newTaskForm.due_date} onChange={e => setNewTaskForm(p => ({ ...p, due_date: e.target.value }))} /></td>
                  <td className="px-3 py-1.5">
                    <select className="form-select text-xs py-1" value={newTaskForm.status} onChange={e => setNewTaskForm(p => ({ ...p, status: e.target.value }))}>
                      {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-1.5">
                      <button className="text-xs px-2 py-1 rounded text-gray-900 font-medium disabled:opacity-50" style={{ background: '#29e6d3' }} onClick={handleAddTask} disabled={savingTask}>保存</button>
                      <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setAddingTask(false)}>✕</button>
                    </div>
                  </td>
                </tr>
              )}
              {evTasks.length === 0 && !addingTask ? (
                <tr><td colSpan={6} className="text-center text-gray-400 text-sm py-8">タスクがありません</td></tr>
              ) : (
                evTasks.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(t => {
                  const isOverdue = t.status !== '完了' && t.due_date && t.due_date < today
                  const isEditing = editingTaskId === t.id
                  return (
                    <tr key={t.id} className={`border-b border-gray-50 ${isOverdue && !isEditing ? 'bg-red-50' : isEditing ? 'bg-blue-50' : ''}`}>
                      {isEditing ? (
                        <>
                          <td className="px-3 py-1.5"><input className="form-input text-xs py-1" value={taskEditForm.name} onChange={e => setTaskEditForm(p => ({ ...p, name: e.target.value }))} /></td>
                          <td className="px-3 py-1.5"><input className="form-input text-xs py-1" value={taskEditForm.category} onChange={e => setTaskEditForm(p => ({ ...p, category: e.target.value }))} /></td>
                          <td className="px-3 py-1.5"><input type="date" className="form-input text-xs py-1" value={taskEditForm.start_date} onChange={e => setTaskEditForm(p => ({ ...p, start_date: e.target.value }))} /></td>
                          <td className="px-3 py-1.5"><input type="date" className="form-input text-xs py-1" value={taskEditForm.due_date} onChange={e => setTaskEditForm(p => ({ ...p, due_date: e.target.value }))} /></td>
                          <td className="px-3 py-1.5">
                            <select className="form-select text-xs py-1" value={taskEditForm.status} onChange={e => setTaskEditForm(p => ({ ...p, status: e.target.value }))}>
                              {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex gap-1.5">
                              <button className="text-xs px-2 py-1 rounded text-gray-900 font-medium disabled:opacity-50" style={{ background: '#29e6d3' }} onClick={() => handleSaveTask(t)} disabled={savingTask}>保存</button>
                              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setEditingTaskId(null)}>✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-medium">{t.name}</td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{t.category || '—'}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{formatDate(t.start_date)}</td>
                          <td className={`px-4 py-2.5 text-xs font-mono ${isOverdue ? 'text-red-600 font-bold' : ''}`}>{formatDate(t.due_date)}</td>
                          <td className="px-4 py-2.5">
                            <select className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white" value={t.status} onChange={e => handleTaskStatusChange(t, e.target.value)}>
                              {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-2">
                              <button className="text-xs text-blue-500 hover:underline" onClick={() => { startEditTask(t); setAddingTask(false) }}>編集</button>
                              <button className="text-xs text-red-400 hover:underline" onClick={() => handleDeleteTask(t)}>削除</button>
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
        </div>
      )}

      {/* ── ガントチャートタブ ──────────────────────── */}
      {activeTab === 'gantt' && (
        <div className="bg-white rounded-lg border border-gray-100 p-4 overflow-x-auto">
          {!ganttData ? (
            <p className="text-center text-gray-400 text-sm py-8">開催日またはタスクが未設定です</p>
          ) : (
            <GanttChart tasks={evTasks} ganttData={ganttData} today={today} />
          )}
        </div>
      )}

      {/* ── ステークホルダータブ ────────────────────── */}
      {activeTab === 'stakeholders' && (
        <div className="bg-white rounded-lg border border-gray-100">
          <div className="flex justify-end px-4 py-2 border-b border-gray-100">
            <button className="text-xs px-3 py-1.5 rounded font-semibold text-gray-900 hover:opacity-90"
              style={{ background: '#29e6d3' }}
              onClick={() => setAddingSH(true)}>
              + ステークホルダーを紐づける
            </button>
          </div>

          {/* SH紐づけ追加行 */}
          {addingSH && (
            <div className="px-4 py-3 bg-green-50 border-b border-gray-100 flex items-end gap-3">
              <div className="flex-1">
                <label className="form-label">ステークホルダーを選択</label>
                <select className="form-select" value={selectedSHId} onChange={e => setSelectedSHId(e.target.value)}>
                  <option value="">選択...</option>
                  {unlinkedSH.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.contact_name ? ` (${s.contact_name})` : ''}</option>
                  ))}
                </select>
              </div>
              <button className="text-xs px-3 py-1.5 rounded text-gray-900 font-medium disabled:opacity-50"
                style={{ background: '#29e6d3' }} onClick={handleAddSH} disabled={savingSH || !selectedSHId}>
                {savingSH ? '追加中...' : '追加'}
              </button>
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setAddingSH(false); setSelectedSHId('') }}>キャンセル</button>
            </div>
          )}

          {evStakeholders.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">紐づくステークホルダーがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#262526' }} className="text-white text-xs">
                  <th className="text-left px-4 py-2.5">名称</th>
                  <th className="text-left px-4 py-2.5">種別</th>
                  <th className="text-left px-4 py-2.5">担当者</th>
                  <th className="text-left px-4 py-2.5">連絡状況</th>
                  <th className="text-left px-4 py-2.5">次アクション期限</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {evStakeholders.map(s => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{s.type}</td>
                    <td className="px-4 py-2.5 text-xs">{s.contact_name || '—'}</td>
                    <td className="px-4 py-2.5"><ContactStatusBadge status={s.contact_status} /></td>
                    <td className="px-4 py-2.5 text-xs font-mono">{formatDate(s.next_action_date)}</td>
                    <td className="px-4 py-2.5">
                      <button className="text-xs text-red-400 hover:underline" onClick={() => handleRemoveSH(s.id)}>紐づけ解除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-700 truncate">{value}</p>
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

  const statusColor = { '未着手': '#d1d5db', '進行中': '#3b82f6', '完了': '#29e6d3', '期限超過': '#ef4444' }

  return (
    <div>
      <div className="relative h-6 mb-1">
        {monthLabels.map((m, i) => (
          <span key={i} className="absolute text-xs text-gray-400 -translate-x-1/2" style={{ left: `${m.pos}%` }}>{m.label}</span>
        ))}
      </div>
      <div className="relative">
        {todayPos !== null && <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10" style={{ left: `${todayPos}%` }} title="今日" />}
        {eventPos !== null && <div className="absolute top-0 bottom-0 w-0.5 z-10" style={{ left: `${eventPos}%`, background: '#29e6d3' }} title="開催日" />}
        {tasks.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(t => {
          const pos = getPos(t.due_date)
          if (pos === null) return null
          return (
            <div key={t.id} className="flex items-center gap-2 mb-1.5">
              <div className="w-40 shrink-0 text-xs text-gray-600 truncate" title={t.name}>{t.name}</div>
              <div className="flex-1 relative h-5 bg-gray-50 rounded">
                <div className="absolute top-1 h-3 rounded-sm" style={{ left: `${pos}%`, width: '12px', background: statusColor[t.status] || '#d1d5db', transform: 'translateX(-50%)' }} title={`${t.name}: ${t.due_date}`} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#29e6d3' }} />完了</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#3b82f6' }} />進行中</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#d1d5db' }} />未着手</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-3 rounded inline-block bg-red-400" />今日</span>
        <span className="flex items-center gap-1"><span className="w-0.5 h-3 rounded inline-block" style={{ background: '#29e6d3' }} />開催日</span>
      </div>
    </div>
  )
}
