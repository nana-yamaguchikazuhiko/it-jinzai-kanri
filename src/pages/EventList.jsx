import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { EventStatusBadge } from '../components/StatusBadge'
import { ALL_SMALL_CATS, MID_CAT_COLORS, MID_CAT_DEFAULT_COLOR } from '../constants/categories'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (dateStr === '通年') return '通年'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const midColor = (midCat) => MID_CAT_COLORS[midCat] || MID_CAT_DEFAULT_COLOR

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

  const childMap = useMemo(() => {
    const map = {}
    eventsWithStatus.forEach(ev => {
      if (ev.parent_id) {
        if (!map[ev.parent_id]) map[ev.parent_id] = []
        map[ev.parent_id].push(ev)
      }
    })
    return map
  }, [eventsWithStatus])

  const filtered = useMemo(() => {
    const matchEv = ev => {
      if (filterSmallCat && ev.small_cat !== filterSmallCat) return false
      if (filterStatus && ev.status !== filterStatus) return false
      if (searchText && !ev.name?.includes(searchText)) return false
      return true
    }
    return eventsWithStatus
      .filter(ev => {
        if (ev.parent_id) return false
        const children = childMap[ev.id] || []
        return matchEv(ev) || children.some(matchEv)
      })
      .sort((a, b) => {
        if (a.event_date === '通年' && b.event_date !== '通年') return -1
        if (a.event_date !== '通年' && b.event_date === '通年') return 1
        return (a.event_date || '').localeCompare(b.event_date || '')
      })
  }, [eventsWithStatus, childMap, filterSmallCat, filterStatus, searchText])

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
            const children = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
            const isParentEv = children.length > 0
            const allIds = isParentEv ? [ev.id, ...children.map(c => c.id)] : [ev.id]
            const allEvTasks = tasks.filter(t => allIds.includes(t.event_id))
            const completedTasks = allEvTasks.filter(t => t.status === '完了').length
            const progress = allEvTasks.length > 0 ? Math.round((completedTasks / allEvTasks.length) * 100) : 0
            const borderCls = midColor(ev.mid_cat).border
            return (
              <div key={ev.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-100 ${borderCls} overflow-hidden hover:shadow-md transition-shadow`}>
                <div className="p-4 cursor-pointer" onClick={() => navigate(`/events/${ev.id}`)}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      {isParentEv && (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#e0f7fa', color: '#0891b2', fontWeight: 700, marginRight: 5, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>親</span>
                      )}
                      <h3 className="font-semibold text-gray-800 text-sm leading-snug" style={{ display: 'inline' }}>{ev.name}</h3>
                    </div>
                    {!isParentEv && <EventStatusBadge status={ev.status} />}
                  </div>
                  <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                    <div>{ev.big_cat} › {ev.mid_cat} › <span className="text-gray-600">{ev.small_cat}</span></div>
                    <div>開催日: <span className="text-gray-600">{formatDate(ev.event_date)}</span></div>
                    {ev.venue && <div>会場: {ev.venue}</div>}
                  </div>
                  {allEvTasks.length > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>タスク進捗{isParentEv ? '（全体）' : ''}</span>
                        <span>{completedTasks}/{allEvTasks.length} ({progress}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: '#06b6d4' }} />
                      </div>
                    </div>
                  )}
                </div>
                {isParentEv && (
                  <div style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
                    {children.map((child, ci) => (
                      <div key={child.id}
                        style={{ padding: '7px 14px 7px 18px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', borderBottom: ci < children.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                        className="hover:bg-gray-100 transition-colors"
                        onClick={e => { e.stopPropagation(); navigate(`/events/${child.id}`) }}>
                        <span style={{ color: '#d1d5db', fontSize: 11, flexShrink: 0 }}>└</span>
                        <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(child.event_date)}</span>
                        <EventStatusBadge status={child.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── 年間スケジュール（ガント）表示 ── */
        <AnnualGantt events={filtered} tasks={tasks} childMap={childMap} onEventClick={id => navigate(`/events/${id}`)} />
      )}
    </div>
  )
}

function AnnualGantt({ events, tasks, childMap = {}, onEventClick }) {
  const today = new Date()

  // 現在の年度（4月始まり）
  const fiscalYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1

  // 4月〜3月の12ヶ月（インデックス0=4月, 11=3月）
  const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
  const monthYear = (i) => i < 9 ? fiscalYear : fiscalYear + 1

  // 開催日を位置（0〜100%）に変換。年度外は境界値を返す
  const getEventPos = (dateStr) => {
    if (!dateStr || dateStr === '通年') return null
    const d = new Date(dateStr)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    for (let i = 0; i < 12; i++) {
      if (MONTHS[i] === m && monthYear(i) === y) {
        const days = new Date(y, m, 0).getDate()
        return (i + (d.getDate() - 1) / days) / 12 * 100
      }
    }
    if (d < new Date(fiscalYear, 3, 1)) return 0
    if (d > new Date(fiscalYear + 1, 2, 31)) return 100
    return null
  }

  // 今日の位置
  const todayPos = (() => {
    const m = today.getMonth() + 1
    const y = today.getFullYear()
    for (let i = 0; i < 12; i++) {
      if (MONTHS[i] === m && monthYear(i) === y) {
        const days = new Date(y, m, 0).getDate()
        return (i + (today.getDate() - 1) / days) / 12 * 100
      }
    }
    return null
  })()

  const eventData = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      if (a.event_date === '通年' && b.event_date !== '通年') return -1
      if (a.event_date !== '通年' && b.event_date === '通年') return 1
      return (a.event_date || '').localeCompare(b.event_date || '')
    })
    const result = []
    sorted.forEach(ev => {
      const children = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
      result.push({ ...ev, taskCount: tasks.filter(t => t.event_id === ev.id).length, isParentRow: children.length > 0, indented: false })
      children.forEach(child => {
        result.push({ ...child, taskCount: tasks.filter(t => t.event_id === child.id).length, isParentRow: false, indented: true })
      })
    })
    return result
  }, [events, tasks, childMap])

  const NAME_W = 210

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

        {/* 年度ヘッダー */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>
          {fiscalYear}年度（{fiscalYear}年4月 〜 {fiscalYear + 1}年3月）
        </div>

        {/* 月ラベル行 */}
        <div style={{ display: 'flex', marginBottom: 4 }}>
          <div style={{ width: NAME_W, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>
            {MONTHS.map((m, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                {m === 1 && (
                  <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, lineHeight: 1 }}>
                    {fiscalYear + 1}
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.8 }}>{m}月</div>
              </div>
            ))}
          </div>
        </div>

        {/* イベント行 */}
        <div>
          {eventData.map((ev, rowIdx) => {
            const isNennen = ev.event_date === '通年'
            const eventPos = getEventPos(ev.event_date)

            return (
              <div key={ev.id}
                style={{ display: 'flex', alignItems: 'center', marginBottom: ev.indented ? 3 : 5, cursor: 'pointer' }}
                onClick={() => onEventClick(ev.id)}>

                {/* イベント名 */}
                <div style={{ width: NAME_W, flexShrink: 0, paddingRight: 12, paddingLeft: ev.indented ? 16 : 0 }}>
                  <div style={{ fontSize: ev.indented ? 11 : 12, color: ev.indented ? '#64748b' : '#1e2d3d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, fontWeight: ev.isParentRow ? 700 : 400 }} title={ev.name}>
                    {ev.indented && <span style={{ color: '#d1d5db', marginRight: 4 }}>└</span>}
                    {ev.name}
                  </div>
                  {ev.small_cat && !ev.indented && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#e0f7fa', color: '#0891b2', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {ev.small_cat}
                    </span>
                  )}
                </div>

                {/* チャートエリア（12等分） */}
                <div style={{ flex: 1, position: 'relative', height: ev.indented ? 26 : 32, background: ev.isParentRow ? '#f0f9ff' : (rowIdx % 2 === 0 ? '#f8fafc' : '#fff'), border: '1px solid #e8edf2', borderRadius: 4 }}>
                  {/* 月区切り線 */}
                  {[1,2,3,4,5,6,7,8,9,10,11].map(i => (
                    <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i/12*100}%`, width: 1, background: '#e8edf2' }} />
                  ))}

                  {/* 今日の縦線 */}
                  {todayPos !== null && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${todayPos}%`, width: 1.5, background: '#f87171', zIndex: 4 }} />
                  )}

                  {/* 通年バー */}
                  {isNennen && (() => {
                    const c = midColor(ev.mid_cat)
                    return (
                      <div style={{
                        position: 'absolute', top: 5, left: 3, right: 3, height: 22,
                        background: c.bar,
                        borderRadius: 5, zIndex: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 10, color: '#fff', fontWeight: 700, letterSpacing: 1 }}>通年</span>
                      </div>
                    )
                  })()}

                  {/* 開催日マーカー */}
                  {!isNennen && eventPos !== null && (
                    <div title={`開催日: ${formatDate(ev.event_date)}`}
                      style={{
                        position: 'absolute', top: '50%', left: `${eventPos}%`,
                        transform: 'translate(-50%, -50%)',
                        width: 14, height: 14, borderRadius: '50%',
                        background: midColor(ev.mid_cat).dot,
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 1.5px #94a3b8',
                        zIndex: 3,
                      }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
          {Object.entries(MID_CAT_COLORS).map(([mid, c]) => (
            <span key={mid} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: c.dot, border: '2px solid #fff', boxShadow: '0 0 0 1.5px #94a3b8' }} />
              {mid}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 2, height: 12, background: '#f87171' }} />今日
          </span>
        </div>
      </div>
    </div>
  )
}
