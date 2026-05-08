import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'
import Badge, { eventStatusTone } from '../components/Badge'
import CategoryChip, { getEventCatKey, CategoryLegend, CAT_DEFS } from '../components/CategoryChip'

/* ── 日付ユーティリティ ── */
function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (dateStr === '通年') return '通年'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(dateStr) {
  if (!dateStr || dateStr === '通年') return '通年'
  const m = dateStr.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
  if (!m) return dateStr
  return `${m[2]}/${m[3]}`
}

// 月インデックス(4月=0 〜 3月=11)
function monthIdx(dateStr) {
  const m = dateStr?.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
  if (!m) return null
  const mo = parseInt(m[2], 10)
  return mo >= 4 ? mo - 4 : mo + 8
}

function daysInMonth(year, mo) { return new Date(year, mo, 0).getDate() }

// タイムライン上の水平位置(%)
function timelinePos(dateStr) {
  const m = dateStr?.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const mo   = parseInt(m[2], 10)
  const day  = parseInt(m[3], 10)
  const idx  = mo >= 4 ? mo - 4 : mo + 8
  const days = daysInMonth(year, mo)
  return (idx + (day - 1) / days) / 12 * 100
}

/* ── 子イベント ミニステータス ── */
function childMiniStatus(child, childTasks, today) {
  if (child.status === '完了') return { label: '完了', tone: 'info' }
  if (childTasks.length > 0 && childTasks.every(t => t.status === '完了'))
    return { label: '完了', tone: 'info' }
  const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0] }
  const in5 = addDays(today, 5); const in7 = addDays(today, 7)
  const incomplete = childTasks.filter(t => t.status !== '完了')
  let hasOverdue = false, hasSoonDue = false, hasSoonStart = false
  if (incomplete.length > 0) {
    hasOverdue   = incomplete.some(t => t.due_date   && t.due_date   <  today)
    hasSoonDue   = incomplete.some(t => t.due_date   && t.due_date   <= in5)
    hasSoonStart = incomplete.some(t => t.start_date && t.start_date <= in7)
  } else if (child.event_date && child.event_date !== '通年') {
    hasOverdue   = child.event_date < today
    hasSoonDue   = child.event_date <= in5
    hasSoonStart = child.event_date <= in7
  }
  if (hasOverdue)   return { label: 'やばい！',   tone: 'danger'  }
  if (hasSoonDue)   return { label: '着手して！', tone: 'warning' }
  if (hasSoonStart) return { label: '着手しよう', tone: 'warning' }
  return               { label: '順調',           tone: 'success' }
}

/* ── 共通スタイル ── */
const TH = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }
const TD = { padding: '12px 16px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

/* ── ビュー切替トグル ── */
const VIEW_OPTS = [
  { key: 'card',     label: 'カード' },
  { key: 'table',    label: 'コンパクト表' },
  { key: 'kanban',   label: '区分カンバン' },
  { key: 'timeline', label: 'タイムラインHub' },
  { key: 'gantt',    label: '年間スケジュール' },
]

function ViewToggle({ view, setView }) {
  return (
    <div style={{ display: 'inline-flex', background: T.surfaceAlt, borderRadius: 3, padding: 3, border: `1px solid ${T.border}` }}>
      {VIEW_OPTS.map(({ key, label }) => (
        <button key={key} onClick={() => setView(key)} style={{
          padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          color: view === key ? T.ink : T.muted,
          background: view === key ? T.surface : 'transparent',
          border: 'none', borderRadius: 2,
          boxShadow: view === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
        }}>{label}</button>
      ))}
    </div>
  )
}

/* ── カンバン列順 ── */
const KANBAN_COLS = ['student', 'enterprise', 'education', 'matching', 'none']

/* ═══════════════════════════════════════
   EventList（メインコンポーネント）
   ══════════════════════════════════════ */
export default function EventList() {
  const navigate = useNavigate()
  const { rows: events, loading, error } = useSheets('events')
  const { rows: tasks } = useSheets('tasks')

  const today = new Date().toISOString().split('T')[0]

  const [filterSmallCat, setFilterSmallCat] = useState('')
  const [filterStatus,   setFilterStatus  ] = useState('')
  const [searchText,     setSearchText    ] = useState('')
  const [view,           setView          ] = useState('card')

  // 自動ステータス計算
  const eventsWithStatus = useMemo(() => {
    const todayStr = today
    const in3Days  = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0] })()
    return events.map(ev => {
      if (ev.status === '完了') return ev
      const evTasks      = tasks.filter(t => t.event_id === ev.id)
      const overdueTasks = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date < todayStr)
      const soonTasks    = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date >= todayStr && t.due_date <= in3Days)
      const completedRatio = evTasks.length > 0 ? evTasks.filter(t => t.status === '完了').length / evTasks.length : 0
      const isDistant  = ev.event_date && ev.event_date > (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0] })()
      let autoStatus = ev.status || '計画中'
      if (overdueTasks.length > 0)   autoStatus = '要対応'
      else if (soonTasks.length > 0) autoStatus = '注意'
      else if (completedRatio >= 0.75) autoStatus = '順調'
      else if (isDistant && evTasks.every(t => t.status === '未着手')) autoStatus = '計画中'
      return { ...ev, status: autoStatus }
    })
  }, [events, tasks, today])

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
      if (filterStatus   && ev.status    !== filterStatus)   return false
      if (searchText     && !ev.name?.includes(searchText))  return false
      return true
    }
    return eventsWithStatus
      .filter(ev => {
        if (ev.parent_id) return false
        return matchEv(ev) || (childMap[ev.id] || []).some(matchEv)
      })
      .sort((a, b) => {
        if (a.event_date === '通年' && b.event_date !== '通年') return -1
        if (a.event_date !== '通年' && b.event_date === '通年') return 1
        return (a.event_date || '').localeCompare(b.event_date || '')
      })
  }, [eventsWithStatus, childMap, filterSmallCat, filterStatus, searchText])

  const smallCats = useMemo(() => [...new Set(events.map(e => e.small_cat).filter(Boolean))], [events])

  // タスク進捗計算
  function calcProgress(ev) {
    const children  = childMap[ev.id] || []
    const allIds    = children.length > 0 ? [ev.id, ...children.map(c => c.id)] : [ev.id]
    const allTasks  = tasks.filter(t => allIds.includes(t.event_id))
    if (allTasks.length === 0) return null
    return Math.round(allTasks.filter(t => t.status === '完了').length / allTasks.length * 100)
  }

  const selStyle = {
    width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', color: T.ink,
    border: `1px solid ${T.border}`, borderRadius: 3, background: T.surface, outline: 'none',
  }

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>イベント管理</span></TopBar>
      <div style={{ padding: 28 }}>
        <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 4, padding: '14px 18px', fontSize: 13 }}>
          データ取得エラー: {error}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>イベント管理</span></TopBar>

      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PageHeader
          title="イベント一覧"
          subtitle={`${filtered.length} / ${events.length}件 表示中`}
          actions={
            <>
              <ViewToggle view={view} setView={setView} />
              <Btn kind="primary" icon={Icon.plus()} onClick={() => navigate('/events/new')}>新規登録</Btn>
            </>
          }
        />

        {/* フィルターカード */}
        <div style={{ background: T.surface, borderRadius: 3, border: `1px solid ${T.border}`, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted, display: 'inline-flex' }}>{Icon.search(14)}</span>
              <input placeholder="イベント名で検索..." value={searchText} onChange={e => setSearchText(e.target.value)}
                style={{ ...selStyle, paddingLeft: 34 }} />
            </div>
            <select style={selStyle} value={filterSmallCat} onChange={e => setFilterSmallCat(e.target.value)}>
              <option value="">すべての小分類</option>
              {smallCats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={selStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">すべての状態</option>
              {['要対応', '注意', '順調', '計画中', '完了'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Btn kind="ghost" size="sm" icon={Icon.filter()} onClick={() => { setFilterSmallCat(''); setFilterStatus(''); setSearchText('') }}>
              クリア
            </Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.borderSoft}` }}>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, flexShrink: 0 }}>区分:</span>
            <CategoryLegend />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.muted, fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.muted, fontSize: 13 }}>
            {events.length === 0 ? 'イベントがまだ登録されていません' : 'フィルター条件に一致するイベントがありません'}
          </div>
        ) : view === 'card' ? (
          <CardView filtered={filtered} tasks={tasks} childMap={childMap} today={today} navigate={navigate} calcProgress={calcProgress} />
        ) : view === 'table' ? (
          <CompactTableView filtered={filtered} tasks={tasks} childMap={childMap} calcProgress={calcProgress} navigate={navigate} />
        ) : view === 'kanban' ? (
          <KanbanView filtered={filtered} tasks={tasks} childMap={childMap} calcProgress={calcProgress} navigate={navigate} />
        ) : view === 'timeline' ? (
          <TimelineHubView filtered={filtered} tasks={tasks} childMap={childMap} calcProgress={calcProgress} navigate={navigate} />
        ) : (
          <AnnualGantt events={filtered} tasks={tasks} childMap={childMap} onEventClick={id => navigate(`/events/${id}`)} />
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   CARD VIEW（既存）
   ══════════════════════════════════════ */
function CardView({ filtered, tasks, childMap, today, navigate, calcProgress }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {filtered.map(ev => {
        const children   = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
        const isParentEv = children.length > 0
        const progress   = calcProgress(ev)
        const catKey     = getEventCatKey(ev.small_cat)
        const catDef     = CAT_DEFS[catKey]
        const path       = [ev.big_cat, ev.mid_cat, ev.small_cat].filter(Boolean).join(' › ')

        return (
          <div key={ev.id}
            style={{ background: T.surface, borderRadius: 3, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}
            onClick={() => navigate(`/events/${ev.id}`)}>
            <div style={{ height: 3, background: catDef?.color || T.border, flexShrink: 0 }} />
            <div style={{ padding: '14px 16px 12px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CategoryChip cat={catKey} size="sm" />
                  {isParentEv && <Badge tone="neutral" size="xs">親</Badge>}
                </div>
                {!isParentEv && <Badge tone={eventStatusTone(ev.status)} dot>{ev.status || '—'}</Badge>}
              </div>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6, lineHeight: 1.4 }}>{ev.name}</h4>
              <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{path || '—'}</p>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.inkSoft }}>
                <span><span style={{ color: T.muted }}>開催:</span> {formatDate(ev.event_date)}</span>
                {ev.venue && <span><span style={{ color: T.muted }}>会場:</span> {ev.venue}</span>}
              </div>
              {progress !== null && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>タスク進捗{isParentEv ? '（全体）' : ''}</span>
                    <span style={{ fontSize: 11, color: T.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                  </div>
                  <div style={{ height: 5, background: T.borderSoft, borderRadius: 99 }}>
                    <div style={{ width: `${Math.max(progress, 2)}%`, height: '100%', background: catDef?.color || T.teal, borderRadius: 99 }} />
                  </div>
                </div>
              )}
            </div>
            {isParentEv && (
              <div style={{ background: T.surfaceAlt, padding: '8px 14px', borderTop: `1px solid ${T.borderSoft}` }}>
                {children.map((child, ci) => {
                  const childTasks = tasks.filter(t => t.event_id === child.id)
                  const mini = childMiniStatus(child, childTasks, new Date().toISOString().split('T')[0])
                  return (
                    <div key={child.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 4px', gap: 8, borderBottom: ci < children.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}
                      onClick={e => { e.stopPropagation(); navigate(`/events/${child.id}`) }}>
                      <span style={{ fontSize: 11, color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>↳ {child.name}</span>
                      <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{formatDate(child.event_date)}</span>
                      <Badge tone={mini.tone} size="xs">{mini.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   VARIANT A — コンパクト表
   ══════════════════════════════════════ */
function CompactTableView({ filtered, tasks, childMap, calcProgress, navigate }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.border}` }}>
            <th style={{ ...TH, width: 56 }}>区分</th>
            <th style={{ ...TH, minWidth: 280 }}>イベント名 / 小分類</th>
            <th style={{ ...TH, width: 130 }}>開催日</th>
            <th style={{ ...TH, width: 130 }}>会場</th>
            <th style={{ ...TH, width: 200 }}>進捗</th>
            <th style={{ ...TH, width: 120 }}>状態</th>
            <th style={{ ...TH, width: 50 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((ev, i) => {
            const children   = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
            const isParentEv = children.length > 0
            const progress   = calcProgress(ev)
            const catKey     = getEventCatKey(ev.small_cat)
            const catDef     = CAT_DEFS[catKey]
            const path       = [ev.big_cat, ev.mid_cat, ev.small_cat].filter(Boolean).join(' › ')

            return (
              <>
                <tr key={ev.id}
                  style={{ borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none', cursor: 'pointer' }}
                  onClick={() => navigate(`/events/${ev.id}`)}>
                  <td style={{ ...TD, width: 56 }}><CategoryChip cat={catKey} /></td>
                  <td style={{ ...TD, paddingLeft: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isParentEv && <span style={{ color: T.muted, fontSize: 10, display: 'inline-flex' }}>{Icon.chevD ? <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg> : '▽'}</span>}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {ev.name}
                          {isParentEv && (
                            <span style={{ fontSize: 10, color: catDef?.color, fontWeight: 700, background: catDef?.bg, padding: '1px 6px', borderRadius: 2 }}>
                              親 · {children.length}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{path || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{formatDate(ev.event_date)}</td>
                  <td style={{ ...TD, fontSize: 12, color: T.inkSoft }}>{ev.venue || <span style={{ color: T.faint }}>—</span>}</td>
                  <td style={TD}>
                    {progress != null ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(progress, 2)}%`, height: '100%', background: catDef?.color || T.teal, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums', minWidth: 28, textAlign: 'right' }}>{progress}%</span>
                      </div>
                    ) : <span style={{ fontSize: 11, color: T.faint }}>—</span>}
                  </td>
                  <td style={TD}><Badge tone={eventStatusTone(ev.status)} dot>{ev.status || '—'}</Badge></td>
                  <td style={TD}>
                    <button style={{ width: 26, height: 26, borderRadius: 3, border: 'none', background: 'transparent', color: T.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); navigate(`/events/${ev.id}`) }}>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                    </button>
                  </td>
                </tr>
                {isParentEv && children.map((child, j) => (
                  <tr key={`${ev.id}-${child.id}`}
                    style={{ background: T.surfaceAlt, borderTop: `1px solid ${T.borderSoft}`, cursor: 'pointer' }}
                    onClick={() => navigate(`/events/${child.id}`)}>
                    <td style={{ ...TD, padding: '8px 16px' }}></td>
                    <td style={{ ...TD, padding: '8px 16px', paddingLeft: 28 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: catDef?.color, fontWeight: 700 }}>└</span>
                        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>{child.name}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, padding: '8px 16px', fontSize: 11, color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{formatDate(child.event_date)}</td>
                    <td colSpan={2} style={{ ...TD, padding: '8px 16px' }}></td>
                    <td style={{ ...TD, padding: '8px 16px' }}>
                      <Badge tone={eventStatusTone(child.status)} dot size="xs">{child.status || '—'}</Badge>
                    </td>
                    <td style={{ ...TD, padding: '8px 16px' }}></td>
                  </tr>
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ══════════════════════════════════════
   VARIANT B — 区分カンバン（5カラム）
   ══════════════════════════════════════ */
function KanbanView({ filtered, tasks, childMap, calcProgress, navigate }) {
  const grouped = useMemo(() => {
    const map = {}
    KANBAN_COLS.forEach(k => { map[k] = [] })
    filtered.forEach(ev => {
      const key = getEventCatKey(ev.small_cat)
      map[key].push(ev)
    })
    return map
  }, [filtered])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${KANBAN_COLS.length}, 1fr)`, gap: 10, flex: 1, minHeight: 0 }}>
      {KANBAN_COLS.map(key => {
        const cat  = CAT_DEFS[key]
        const list = grouped[key]
        return (
          <div key={key} style={{ background: T.surfaceAlt, borderRadius: 3, border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* カラムヘッダ */}
            <div style={{ padding: '10px 14px', borderBottom: `2px solid ${cat?.color || T.border}`, background: T.surface, borderRadius: '3px 3px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CategoryChip cat={key} size="sm" />
                <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{cat?.label}</span>
              </div>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{list.length}件</span>
            </div>
            {/* カード */}
            <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(ev => {
                const children   = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
                const isParentEv = children.length > 0
                const progress   = calcProgress(ev)
                const path       = [ev.big_cat, ev.mid_cat, ev.small_cat].filter(Boolean).join(' › ')

                return (
                  <div key={ev.id}
                    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, padding: '10px 12px', borderLeft: `3px solid ${cat?.color || T.border}`, cursor: 'pointer' }}
                    onClick={() => navigate(`/events/${ev.id}`)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Badge tone={eventStatusTone(ev.status)} dot size="xs">{ev.status || '—'}</Badge>
                      {isParentEv && (
                        <span style={{ fontSize: 9, color: cat?.color, fontWeight: 700, background: cat?.bg, padding: '1px 5px', borderRadius: 2 }}>
                          親 · {children.length}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, lineHeight: 1.4, marginBottom: 4 }}>{ev.name}</div>
                    <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{path || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: T.inkSoft, gap: 8 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {formatDate(ev.event_date)}
                      </span>
                      {progress != null && <span style={{ fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>}
                    </div>
                    {progress != null && (
                      <div style={{ height: 3, background: T.borderSoft, borderRadius: 99, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(progress, 2)}%`, height: '100%', background: cat?.color || T.teal, borderRadius: 99 }} />
                      </div>
                    )}
                    {isParentEv && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {children.map(child => (
                          <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5 }}
                            onClick={e => { e.stopPropagation(); navigate(`/events/${child.id}`) }}>
                            <span style={{ color: cat?.color, fontWeight: 700 }}>└</span>
                            <span style={{ color: T.inkSoft, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</span>
                            <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{shortDate(child.event_date)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <button style={{ padding: 10, border: `1px dashed ${T.border}`, background: 'transparent', color: T.muted, fontSize: 12, fontWeight: 500, borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> 追加
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   VARIANT C — タイムラインHub
   ══════════════════════════════════════ */
const MONTHS = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月']

function TimelineHubView({ filtered, tasks, childMap, calcProgress, navigate }) {
  const today = new Date()
  const curMonthIdx = (() => { const mo = today.getMonth() + 1; return mo >= 4 ? mo - 4 : mo + 8 })()
  const todayPct    = (curMonthIdx + (today.getDate() - 1) / daysInMonth(today.getFullYear(), today.getMonth() + 1)) / 12 * 100

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden' }}>
      {/* タイムラインヘッダ */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 130px', borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt }}>
        <div style={{ ...TH, padding: '10px 16px' }}>イベント</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', borderLeft: `1px solid ${T.border}` }}>
          {MONTHS.map((m, i) => (
            <div key={i} style={{
              padding: '10px 0', textAlign: 'center', fontSize: 11, color: i === curMonthIdx ? T.warning : T.muted, fontWeight: i === curMonthIdx ? 700 : 600,
              borderRight: i < 11 ? `1px solid ${T.borderSoft}` : 'none',
              background: i === curMonthIdx ? '#fff8eb' : 'transparent',
            }}>{m}</div>
          ))}
        </div>
        <div style={{ ...TH, padding: '10px 16px', textAlign: 'right', borderLeft: `1px solid ${T.border}` }}>進捗</div>
      </div>

      {/* イベント行 */}
      {filtered.map((ev, i) => {
        const children   = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
        const isParentEv = children.length > 0
        const progress   = calcProgress(ev)
        const catKey     = getEventCatKey(ev.small_cat)
        const catDef     = CAT_DEFS[catKey]
        const path       = [ev.big_cat, ev.mid_cat, ev.small_cat].filter(Boolean).join(' › ')
        const rowH       = Math.max(76, (isParentEv ? children.length : 1) * 24 + 32)

        return (
          <div key={ev.id} style={{
            display: 'grid', gridTemplateColumns: '300px 1fr 130px',
            borderTop: i > 0 ? `1px solid ${T.borderSoft}` : 'none',
            minHeight: rowH,
          }}>
            {/* 左: イベント情報 */}
            <div style={{ padding: '10px 14px', borderRight: `1px solid ${T.border}`, display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
              onClick={() => navigate(`/events/${ev.id}`)}>
              <CategoryChip cat={catKey} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path || '—'}</div>
                <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Badge tone={eventStatusTone(ev.status)} dot size="xs">{ev.status || '—'}</Badge>
                  {isParentEv && <span style={{ fontSize: 10, color: catDef?.color, fontWeight: 700 }}>親 · {children.length}件</span>}
                </div>
              </div>
            </div>

            {/* 中央: タイムライン */}
            <div style={{ position: 'relative' }}>
              {/* 月グリッド線 */}
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', pointerEvents: 'none' }}>
                {MONTHS.map((_, j) => (
                  <div key={j} style={{ borderRight: j < 11 ? `1px solid ${T.borderSoft}` : 'none', background: j === curMonthIdx ? 'rgba(245,158,11,0.04)' : 'transparent' }} />
                ))}
              </div>
              {/* 今日マーカー */}
              <div style={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, width: 1, background: T.warning, opacity: 0.7, pointerEvents: 'none' }} />

              {/* 通年バー（非親） */}
              {ev.event_date === '通年' && !isParentEv && (
                <div style={{ position: 'absolute', left: 8, right: 8, top: '50%', transform: 'translateY(-50%)', height: 22, background: catDef?.bg || T.surfaceAlt, border: `1px solid ${(catDef?.color || T.border)}40`, borderRadius: 3, display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                  <span style={{ fontSize: 10, color: catDef?.color || T.muted, fontWeight: 700 }}>通年</span>
                </div>
              )}

              {/* 子イベントピン */}
              {isParentEv && children.map((child, j) => {
                const idx = monthIdx(child.event_date)
                if (idx == null) {
                  return (
                    <div key={child.id} style={{ position: 'absolute', left: 8, right: 8, top: 8 + j * 24, height: 18, background: catDef?.bg || T.surfaceAlt, border: `1px dashed ${(catDef?.color || T.border)}60`, borderRadius: 3, display: 'flex', alignItems: 'center', paddingLeft: 8, cursor: 'pointer' }}
                      onClick={() => navigate(`/events/${child.id}`)}>
                      <span style={{ fontSize: 9.5, color: catDef?.color || T.muted, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>通年: {child.name}</span>
                    </div>
                  )
                }
                const pct  = timelinePos(child.event_date)
                const left = `calc(${pct}% - 5px)`
                return (
                  <div key={child.id} style={{ position: 'absolute', left, top: 8 + j * 24, display: 'flex', alignItems: 'center', gap: 5, height: 18, cursor: 'pointer' }}
                    onClick={() => navigate(`/events/${child.id}`)}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: catDef?.color || T.muted, border: '2px solid #fff', boxShadow: `0 0 0 1px ${catDef?.color || T.muted}40`, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: T.ink, fontWeight: 600, whiteSpace: 'nowrap', background: T.surface, padding: '1px 6px', borderRadius: 2, border: `1px solid ${T.border}`, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {child.name} <span style={{ color: T.muted, fontWeight: 500, marginLeft: 3 }}>{shortDate(child.event_date)}</span>
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 右: 進捗 */}
            <div style={{ padding: '10px 14px', borderLeft: `1px solid ${T.border}`, display: 'flex', alignItems: 'center' }}>
              {progress != null ? (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>進捗</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                  </div>
                  <div style={{ height: 5, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(progress, 2)}%`, height: '100%', background: catDef?.color || T.teal, borderRadius: 99 }} />
                  </div>
                </div>
              ) : <span style={{ fontSize: 11, color: T.faint }}>—</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   ANNUAL GANTT（既存）
   ══════════════════════════════════════ */
function AnnualGantt({ events, tasks, childMap = {}, onEventClick }) {
  const today = new Date()
  const fiscalYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  const GANTT_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
  const monthYear = (i) => i < 9 ? fiscalYear : fiscalYear + 1

  const getEventPos = (dateStr) => {
    if (!dateStr || dateStr === '通年') return null
    const d = new Date(dateStr)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    for (let i = 0; i < 12; i++) {
      if (GANTT_MONTHS[i] === m && monthYear(i) === y) {
        const days = new Date(y, m, 0).getDate()
        return (i + (d.getDate() - 1) / days) / 12 * 100
      }
    }
    if (d < new Date(fiscalYear, 3, 1)) return 0
    if (d > new Date(fiscalYear + 1, 2, 31)) return 100
    return null
  }

  const todayPos = (() => {
    const m = today.getMonth() + 1
    const y = today.getFullYear()
    for (let i = 0; i < 12; i++) {
      if (GANTT_MONTHS[i] === m && monthYear(i) === y) {
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

  if (eventData.length === 0) return (
    <div style={{ background: T.surface, borderRadius: 3, border: `1px solid ${T.border}`, padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>
      表示できるイベントがありません
    </div>
  )

  return (
    <div style={{ background: T.surface, borderRadius: 3, border: `1px solid ${T.border}`, padding: '24px 28px', overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>
          {fiscalYear}年度（{fiscalYear}年4月 〜 {fiscalYear + 1}年3月）
        </div>
        <div style={{ display: 'flex', marginBottom: 4 }}>
          <div style={{ width: NAME_W, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>
            {GANTT_MONTHS.map((m, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                {m === 1 && <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, lineHeight: 1 }}>{fiscalYear + 1}</div>}
                <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{m}月</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          {eventData.map((ev) => {
            const isNennen = ev.event_date === '通年'
            const eventPos = getEventPos(ev.event_date)
            const catKey   = getEventCatKey(ev.small_cat)
            const dotColor = CAT_DEFS[catKey]?.color || T.muted

            return (
              <div key={ev.id}
                style={{ display: 'flex', alignItems: 'center', marginBottom: ev.indented ? 3 : 5, cursor: 'pointer' }}
                onClick={() => onEventClick(ev.id)}>
                <div style={{ width: NAME_W, flexShrink: 0, paddingRight: 12, paddingLeft: ev.indented ? 16 : 0 }}>
                  <div style={{ fontSize: ev.indented ? 11 : 12, color: ev.indented ? T.inkSoft : T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4, fontWeight: ev.isParentRow ? 700 : 400 }} title={ev.name}>
                    {ev.indented && <span style={{ color: T.faint, marginRight: 4 }}>└</span>}
                    {ev.name}
                  </div>
                  {ev.small_cat && !ev.indented && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: CAT_DEFS[catKey]?.bg || T.surfaceAlt, color: dotColor, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {ev.small_cat}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, height: ev.indented ? 26 : 32, position: 'relative', background: ev.isParentRow ? '#f0f9ff' : 'transparent', borderRadius: 3, display: 'flex', alignItems: 'center' }}>
                  {GANTT_MONTHS.map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${(i / 12) * 100}%`, top: 0, bottom: 0, width: 1, background: T.borderSoft }} />
                  ))}
                  {todayPos != null && (
                    <div style={{ position: 'absolute', left: `${todayPos}%`, top: 0, bottom: 0, width: 1.5, background: T.danger, zIndex: 2 }} />
                  )}
                  {isNennen ? (
                    <div style={{ position: 'absolute', left: '2%', right: '2%', height: 6, borderRadius: 99, background: dotColor, opacity: 0.35 }} />
                  ) : eventPos != null ? (
                    <div style={{ position: 'absolute', left: `${eventPos}%`, transform: 'translateX(-50%)', width: ev.indented ? 8 : 10, height: ev.indented ? 8 : 10, borderRadius: '50%', background: dotColor, zIndex: 3, border: `2px solid ${T.surface}`, boxShadow: '0 0 0 1px rgba(0,0,0,0.1)' }} />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
