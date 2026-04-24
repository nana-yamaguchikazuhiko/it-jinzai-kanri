import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { updateById } from '../api/sheets'
import { TaskStatusBadge, PriorityBadge } from '../components/StatusBadge'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const TASK_STATUSES = ['未着手', '進行中', '完了']

export default function TaskList() {
  const navigate = useNavigate()
  const { rows: tasks, loading, reload: reloadTasks } = useSheets('tasks')
  const { rows: events } = useSheets('events')

  const today = new Date().toISOString().split('T')[0]
  const in3Days = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().split('T')[0]
  })()

  const [filterStatus, setFilterStatus] = useState('')
  const [filterEvent, setFilterEvent] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)

  // イベント名マップ
  const eventMap = useMemo(() =>
    Object.fromEntries(events.map(e => [e.id, e.name])),
  [events])

  // タスクにステータス補正（期日超過チェック）
  const tasksWithStatus = useMemo(() =>
    tasks.map(t => ({
      ...t,
      _isOverdue: t.status !== '完了' && t.due_date && t.due_date < today,
      _isSoon:    t.status !== '完了' && t.due_date && t.due_date >= today && t.due_date <= in3Days,
      _eventName: eventMap[t.event_id] || '—',
    })),
  [tasks, eventMap, today, in3Days])

  const filtered = useMemo(() => tasksWithStatus.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false
    if (filterEvent && t.event_id !== filterEvent) return false
    if (filterOverdue && !t._isOverdue) return false
    return true
  }), [tasksWithStatus, filterStatus, filterEvent, filterOverdue])

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      // 期限超過 → 今日・近日 → 通常（期日昇順）
      if (a._isOverdue && !b._isOverdue) return -1
      if (!a._isOverdue && b._isOverdue) return 1
      if (a._isSoon && !b._isSoon) return -1
      if (!a._isSoon && b._isSoon) return 1
      return (a.due_date || '').localeCompare(b.due_date || '')
    }),
  [filtered])

  const handleStatusChange = async (task, newStatus) => {
    try {
      await updateById('tasks', task.id, { ...task, status: newStatus })
      reloadTasks()
    } catch (e) {
      alert('更新失敗: ' + e.message)
    }
  }

  const overdueCount = tasksWithStatus.filter(t => t._isOverdue).length
  const soonCount    = tasksWithStatus.filter(t => t._isSoon).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">タスク一覧</h1>
        {(overdueCount > 0 || soonCount > 0) && (
          <div className="flex gap-2 text-sm">
            {overdueCount > 0 && (
              <button
                className={`px-3 py-1 rounded-full text-xs font-medium border ${filterOverdue ? 'bg-red-500 text-white border-red-500' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                onClick={() => setFilterOverdue(!filterOverdue)}
              >
                期限超過 {overdueCount}件
              </button>
            )}
            {soonCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium border border-yellow-200 text-yellow-600">
                3日以内 {soonCount}件
              </span>
            )}
          </div>
        )}
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-5 flex gap-3 flex-wrap">
        <select
          className="form-select w-36"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">すべての状態</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="form-select max-w-xs"
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
        >
          <option value="">すべてのイベント</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {(filterStatus || filterEvent || filterOverdue) && (
          <button
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            onClick={() => { setFilterStatus(''); setFilterEvent(''); setFilterOverdue(false) }}
          >
            クリア
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">{sorted.length}件 / {tasks.length}件</p>

      {/* テーブル */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          {sorted.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">タスクがありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#0f1c2e' }} className="text-white text-xs">
                  <th className="text-left px-4 py-2.5">タスク名</th>
                  <th className="text-left px-4 py-2.5">イベント</th>
                  <th className="text-left px-4 py-2.5">カテゴリ</th>
                  <th className="text-left px-4 py-2.5">期日</th>
                  <th className="text-left px-4 py-2.5">優先</th>
                  <th className="text-left px-4 py-2.5">ステータス</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr
                    key={t.id}
                    className={`border-b border-gray-50 hover:bg-gray-50/50 ${
                      t._isOverdue ? 'bg-red-50' : t._isSoon ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium max-w-xs truncate" title={t.name}>
                      {t.name}
                    </td>
                    <td
                      className="px-4 py-2.5 text-xs text-blue-600 hover:underline cursor-pointer max-w-[140px] truncate"
                      title={t._eventName}
                      onClick={() => navigate(`/events/${t.event_id}`)}
                    >
                      {t._eventName}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{t.category || '—'}</td>
                    <td className={`px-4 py-2.5 text-xs font-mono ${t._isOverdue ? 'text-red-600 font-bold' : t._isSoon ? 'text-yellow-600 font-bold' : ''}`}>
                      {formatDate(t.due_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white"
                        value={t.status}
                        onChange={e => handleStatusChange(t, e.target.value)}
                      >
                        {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        className="text-xs text-blue-500 hover:underline"
                        onClick={() => navigate(`/events/${t.event_id}`)}
                      >
                        詳細
                      </button>
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
