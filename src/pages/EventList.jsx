import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { EventStatusBadge } from '../components/StatusBadge'
import { ALL_SMALL_CATS } from '../constants/categories'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const STATUS_BORDER = {
  '要対応': 'border-l-4 border-l-red-400',
  '注意':   'border-l-4 border-l-yellow-400',
  '順調':   'border-l-4 border-l-green-400',
  '計画中': 'border-l-4 border-l-blue-400',
  '完了':   'border-l-4 border-l-gray-300',
}

export default function EventList() {
  const navigate = useNavigate()
  const { rows: events, loading, error, reload } = useSheets('events')
  const { rows: tasks } = useSheets('tasks')

  const [filterSmallCat, setFilterSmallCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText] = useState('')

  // イベントステータスを自動計算
  const eventsWithStatus = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const in3Days = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 3)
      return d.toISOString().split('T')[0]
    })()

    return events.map(ev => {
      // すでにステータスが設定されている場合はそのまま（完了など手動設定）
      if (ev.status === '完了') return ev

      const evTasks = tasks.filter(t => t.event_id === ev.id)
      const overdueTasks = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date < today)
      const soonTasks = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date >= today && t.due_date <= in3Days)
      const completedRatio = evTasks.length > 0
        ? evTasks.filter(t => t.status === '完了').length / evTasks.length
        : 0
      const isDistant = ev.event_date && ev.event_date > (() => {
        const d = new Date()
        d.setDate(d.getDate() + 30)
        return d.toISOString().split('T')[0]
      })()

      let autoStatus = ev.status || '計画中'
      if (overdueTasks.length > 0) autoStatus = '要対応'
      else if (soonTasks.length > 0) autoStatus = '注意'
      else if (completedRatio >= 0.75) autoStatus = '順調'
      else if (isDistant && evTasks.every(t => t.status === '未着手')) autoStatus = '計画中'

      return { ...ev, status: autoStatus }
    })
  }, [events, tasks])

  const filtered = useMemo(() => eventsWithStatus.filter(ev => {
    if (filterSmallCat && ev.small_cat !== filterSmallCat) return false
    if (filterStatus && ev.status !== filterStatus) return false
    if (searchText && !ev.name?.includes(searchText)) return false
    return true
  }), [eventsWithStatus, filterSmallCat, filterStatus, searchText])

  const smallCats = useMemo(() => [...new Set(events.map(e => e.small_cat).filter(Boolean))], [events])

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">
        データ取得エラー: {error}
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">イベント一覧</h1>
        <button
          className="btn-primary flex items-center gap-1.5"
          style={{ background: '#06b6d4', color: '#1a1a1a' }}
          onClick={() => navigate('/events/new')}
        >
          <span className="text-lg leading-none">+</span>新規登録
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-5 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="イベント名で検索..."
          className="form-input max-w-xs"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        <select
          className="form-select max-w-xs"
          value={filterSmallCat}
          onChange={e => setFilterSmallCat(e.target.value)}
        >
          <option value="">すべての小分類</option>
          {smallCats.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="form-select w-36"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">すべての状態</option>
          {['要対応', '注意', '順調', '計画中', '完了'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(filterSmallCat || filterStatus || searchText) && (
          <button
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            onClick={() => { setFilterSmallCat(''); setFilterStatus(''); setSearchText('') }}
          >
            クリア
          </button>
        )}
      </div>

      {/* カウント */}
      <p className="text-xs text-gray-400 mb-4">{filtered.length}件 / {events.length}件</p>

      {/* カード一覧 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {events.length === 0 ? 'イベントがまだ登録されていません' : 'フィルター条件に一致するイベントがありません'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ev => {
            const evTasks = tasks.filter(t => t.event_id === ev.id)
            const completedTasks = evTasks.filter(t => t.status === '完了').length
            const progress = evTasks.length > 0 ? Math.round((completedTasks / evTasks.length) * 100) : 0
            const borderCls = STATUS_BORDER[ev.status] || 'border-l-4 border-l-gray-200'

            return (
              <div
                key={ev.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-100 ${borderCls} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => navigate(`/events/${ev.id}`)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{ev.name}</h3>
                    <EventStatusBadge status={ev.status} />
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                    <div>{ev.big_cat} › {ev.mid_cat} › <span className="text-gray-600">{ev.small_cat}</span></div>
                    <div>開催日: <span className="text-gray-600">{formatDate(ev.event_date)}</span></div>
                    {ev.venue && <div>会場: {ev.venue}</div>}
                  </div>
                  {/* タスク進捗バー */}
                  {evTasks.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>タスク進捗</span>
                        <span>{completedTasks}/{evTasks.length} ({progress}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${progress}%`, background: '#06b6d4' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
