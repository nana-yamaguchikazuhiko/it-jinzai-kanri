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

const STATUS_BAR_COLOR = {
  '要対応': '#fca5a5',
  '注意':   '#fcd34d',
  '順調':   '#86efac',
  '計画中': '#93c5fd',
  '完了':   '#d1d5db',
}

export default function EventList() {
  const navigate = useNavigate()
  const { rows: events, loading, error } = useSheets('events')
  const { rows: tasks } = useSheets('tasks')

  const [filterSmallCat, setFilterSmallCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText] = useState('')
  const [view, setView] = useState('card') // 'card' | 'gantt'

  // イベントステータスを自動計算
  const eventsWithStatus = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const in3Days = (() => {
      const d = new Date(); d.setDate(d.getDate() + 3)
      return d.toISOString().split('T')[0]
    })()

    return events.map(ev => {
      if (ev.status === '完了') return ev
      const evTasks = tasks.filter(t => t.event_id === ev.id)
      const overdueTasks = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date < today)
      const soonTasks = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date >= today && t.due_date <= in3Days)
      const completedRatio = evTasks.length > 0
        ? evTasks.filter(t => t.status === '完了').length / evTasks.length : 0
      const isDistant = ev.event_date && ev.event_date > (() => {
        const d = new Date(); d.setDate(d.getDate() + 30)
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
        <div className="flex items-center gap-3">
          {/* 表示切り替え */}
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { key: 'card',  label: 'カード' },
              { key: 'gantt', label: '年間スケジュール' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setView(key)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  background: view === key ? '#06b6d4' : '#fff',
                  color: view === key ? '#fff' : '#64748b',
                  border: 'none', fontFamily: 'inherit',
                }}>
                {label}
              </button>
            ))}
          </div>
          <button
            className="btn-primary flex items-center gap-1.5"
            style={{ background: '#06b6d4', color: '#1a1a1a' }}
            onClick={() => navigate('/events/new')}
          >
            <span className="text-lg leading-none">+</span>新規登録
          </button>
        </div>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-5 flex gap-3 flex-wrap">
        <input type="text" placeholder="イベント名で検索..." className="form-input max-w-xs"
          value={searchText} onChange={e => setSearchText(e.target.value)} />
        <select className="form-select max-w-xs" value={filterSmallCat}
          onChange={e => setFilterSmallCat(e.target.value)}>
          <option value="">すべての小分類</option>
          {smallCats.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="form-select w-36" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">すべての状態</option>
          {['要対応', '注意', '順調', '計画中', '完了'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(filterSmallCat || filterStatus || searchText) && (
          <button className="text-sm text-gray-500 hover:text-gray-700 underline"
            onClick={() => { setFilterSmallCat(''); setFilterStatus(''); setSearchText('') }}>
            クリア
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">{filtered.length}件 / {events.length}件</p>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {events.length === 0 ? 'イベントがまだ登録されていません' : 'フィルター条件に一致するイベントがありません'}
        </div>
      ) : view === 'card' ? (
        /* ── カード表示 ── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ev => {
            const evTasks = tasks.filter(t => t.event_id === ev.id)
            const completedTasks = evTasks.filter(t => t.status === '完了').length
            const progress = evTasks.length > 0 ? Math.round((completedTasks / evTasks.length) * 100) : 0
            const borderCls = STATUS_BORDER[ev.status] || 'border-l-4 border-l-gray-200'
            return (
              <div key={ev.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-100 ${borderCls} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => navigate(`/events/${ev.id}`)}>
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
                  {evTasks.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>タスク進捗</span>
                        <span>{completedTasks}/{evTasks.length} ({progress}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#06b6d4' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── 年間スケジュール（ガント）表示 ── */
        <AnnualGantt events={filtered} tasks={tasks} onEventClick={id => navigate(`/events/${id}`)} />
      )}
    </div>
  )
}

function AnnualGantt({ events, tasks, onEventClick }) {
  const today = new Date().toISOString().split('T')[0]

  // イベントごとにタスク期間・開催日を計算、開催日順にソート
  const eventData = useMemo(() => {
    return events
      .map(ev => {
        const evTasks = tasks.filter(t => t.event_id === ev.id)
        const dates = evTasks.flatMap(t => [t.start_date, t.due_date]).filter(Boolean)
        const minDate = dates.length > 0 ? dates.reduce((a, b) => a < b ? a : b) : ev.event_date
        const maxDate = dates.length > 0 ? dates.reduce((a, b) => a > b ? a : b) : ev.event_date
        return { ...ev, minDate, maxDate, taskCount: evTasks.length }
      })
      .filter(ev => ev.event_date)
      .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
  }, [events, tasks])

  // タイムライン範囲（全イベントをカバー、月の始まり〜終わりに丸める）
  const { rangeStart, totalDays, monthLabels } = useMemo(() => {
    const allDates = eventData.flatMap(ev => [ev.minDate, ev.maxDate, ev.event_date]).filter(Boolean)
    if (allDates.length === 0) return { rangeStart: null, totalDays: 0, monthLabels: [] }

    const minD = new Date(allDates.reduce((a, b) => a < b ? a : b))
    const maxD = new Date(allDates.reduce((a, b) => a > b ? a : b))

    const rangeStart = new Date(minD.getFullYear(), minD.getMonth(), 1)
    const rangeEnd   = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0)
    const totalDays  = Math.ceil((rangeEnd - rangeStart) / 864e5)

    const getPos = (dateStr) => {
      if (!dateStr) return null
      const diff = Math.ceil((new Date(dateStr) - rangeStart) / 864e5)
      return Math.max(0, Math.min(100, (diff / totalDays) * 100))
    }

    const labels = []
    const cur = new Date(rangeStart)
    while (cur <= rangeEnd) {
      labels.push({
        label: `${cur.getMonth() + 1}月`,
        yearLabel: cur.getMonth() === 0 ? `${cur.getFullYear()}` : null,
        pos: getPos(cur.toISOString().split('T')[0]),
      })
      cur.setMonth(cur.getMonth() + 1)
    }

    return { rangeStart, totalDays, monthLabels: labels }
  }, [eventData])

  const getPos = (dateStr) => {
    if (!dateStr || !rangeStart) return null
    const diff = Math.ceil((new Date(dateStr) - rangeStart) / 864e5)
    return Math.max(0, Math.min(100, (diff / totalDays) * 100))
  }

  const todayPos = getPos(today)
  const NAME_W = 220

  if (eventData.length === 0) {
    return (
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf2', padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        表示できるイベントがありません
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', padding: '24px 28px', overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>

        {/* 月ラベル行 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 6 }}>
          <div style={{ width: NAME_W, flexShrink: 0 }} />
          <div style={{ flex: 1, position: 'relative', height: 32 }}>
            {/* 年ラベル */}
            {monthLabels.filter(m => m.yearLabel).map((m, i) => (
              <span key={`y${i}`} style={{ position: 'absolute', fontSize: 10, color: '#94a3b8', fontWeight: 700, left: `${m.pos}%`, top: 0, transform: 'translateX(-50%)' }}>
                {m.yearLabel}
              </span>
            ))}
            {/* 月ラベル */}
            {monthLabels.map((m, i) => (
              <span key={i} style={{ position: 'absolute', fontSize: 10, color: '#94a3b8', left: `${m.pos}%`, bottom: 0, transform: 'translateX(-50%)' }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* 月グリッド線 + イベント行 */}
        <div style={{ position: 'relative' }}>
          {eventData.map(ev => {
            const barStart  = getPos(ev.minDate)
            const barEnd    = getPos(ev.maxDate)
            const eventPos  = getPos(ev.event_date)
            const barWidth  = (barStart !== null && barEnd !== null) ? Math.max(barEnd - barStart, 0.5) : 0
            const barColor  = '#93c5fd'

            return (
              <div key={ev.id}
                style={{ display: 'flex', alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}
                onClick={() => onEventClick(ev.id)}>

                {/* イベント名 */}
                <div style={{ width: NAME_W, flexShrink: 0, paddingRight: 12 }}>
                  <div style={{ fontSize: 12, color: '#1e2d3d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }} title={ev.name}>
                    {ev.name}
                  </div>
                  {ev.small_cat && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#e0f7fa', color: '#0891b2', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {ev.small_cat}
                    </span>
                  )}
                </div>

                {/* チャートエリア */}
                <div style={{ flex: 1, position: 'relative', height: 32, background: '#f8fafc', borderRadius: 4 }}>
                  {/* 月グリッド線 */}
                  {monthLabels.map((m, i) => (
                    <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${m.pos}%`, width: 1, background: '#e8edf2' }} />
                  ))}

                  {/* 今日の縦線 */}
                  {todayPos !== null && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayPos}%`, width: 1.5, background: '#f87171', zIndex: 4 }} />
                  )}

                  {/* タスク期間バー */}
                  {barStart !== null && barWidth > 0 && (
                    <div style={{
                      position: 'absolute', top: 6, height: 12, borderRadius: 6,
                      left: `${barStart}%`, width: `${barWidth}%`,
                      background: barColor, zIndex: 2,
                    }} />
                  )}

                  {/* 開催日マーカー（円形） */}
                  {eventPos !== null && (
                    <div title={`開催日: ${formatDate(ev.event_date)}`}
                      style={{
                        position: 'absolute', top: '50%', left: `${eventPos}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 12, height: 12, borderRadius: '50%',
                        background: '#06b6d4', border: '2px solid #fff',
                        boxShadow: '0 0 0 1.5px #06b6d4',
                        zIndex: 3,
                      }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 20, height: 8, borderRadius: 3, background: '#93c5fd' }} />タスク期間
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#06b6d4' }} />開催日
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 2, height: 12, background: '#f87171' }} />今日
          </span>
        </div>
      </div>
    </div>
  )
}
