import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { ALL_SMALL_CATS } from '../constants/categories'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'
import Badge, { eventStatusTone } from '../components/Badge'
import CategoryChip, { getEventCatKey, CategoryLegend, CAT_DEFS } from '../components/CategoryChip'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (dateStr === '通年') return '通年'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// 子イベント用 期日ベース自動ステータス
function childMiniStatus(child, childTasks, today) {
  if (child.status === '完了') return { label: '完了', tone: 'info' }
  if (childTasks.length > 0 && childTasks.every(t => t.status === '完了'))
    return { label: '完了', tone: 'info' }
  const addDays = (base, n) => {
    const d = new Date(base); d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  }
  const in5 = addDays(today, 5)
  const in7 = addDays(today, 7)
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

export default function EventList() {
  const navigate = useNavigate()
  const { rows: events, loading, error } = useSheets('events')
  const { rows: tasks } = useSheets('tasks')

  const today = new Date().toISOString().split('T')[0]

  const [filterSmallCat, setFilterSmallCat] = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [searchText,     setSearchText]     = useState('')
  const [view,           setView]           = useState('card')

  const eventsWithStatus = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const in3Days = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0] })()
    return events.map(ev => {
      if (ev.status === '完了') return ev
      const evTasks    = tasks.filter(t => t.event_id === ev.id)
      const overdueTasks = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date < todayStr)
      const soonTasks    = evTasks.filter(t => t.status !== '完了' && t.due_date && t.due_date >= todayStr && t.due_date <= in3Days)
      const completedRatio = evTasks.length > 0 ? evTasks.filter(t => t.status === '完了').length / evTasks.length : 0
      const isDistant = ev.event_date && ev.event_date > (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0] })()
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
      if (filterStatus   && ev.status    !== filterStatus)   return false
      if (searchText     && !ev.name?.includes(searchText))  return false
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

  const inputStyle = (withIcon = false) => ({
    width: '100%', padding: withIcon ? '9px 12px 9px 36px' : '9px 12px',
    fontSize: 13, fontFamily: 'inherit', color: T.ink,
    border: `1px solid ${T.border}`, borderRadius: 8,
    background: T.surface, outline: 'none',
  })

  if (error) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>イベント管理</span></TopBar>
      <div style={{ padding: 28 }}>
        <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '14px 18px', fontSize: 13 }}>
          データ取得エラー: {error}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>イベント管理</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="イベント一覧"
          subtitle={`${filtered.length} / ${events.length}件 表示中`}
          actions={
            <>
              {/* ビュー切替 */}
              <div style={{ display: 'inline-flex', background: T.surfaceAlt, borderRadius: 8, padding: 3, border: `1px solid ${T.border}` }}>
                {[
                  { key: 'card',  label: 'カード' },
                  { key: 'gantt', label: '年間スケジュール' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setView(key)} style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    color: view === key ? T.ink : T.muted,
                    background: view === key ? T.surface : 'transparent',
                    border: 'none', borderRadius: 6, fontFamily: 'inherit',
                    boxShadow: view === key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}>{label}</button>
                ))}
              </div>
              <Btn kind="primary" icon={Icon.plus()} onClick={() => navigate('/events/new')}>新規登録</Btn>
            </>
          }
        />

        {/* フィルターカード */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '14px 18px', marginBottom: 16, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted, display: 'inline-flex' }}>{Icon.search(15)}</span>
              <input
                placeholder="イベント名で検索..."
                style={inputStyle(true)}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <select style={inputStyle()} value={filterSmallCat} onChange={e => setFilterSmallCat(e.target.value)}>
              <option value="">すべての小分類</option>
              {smallCats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={inputStyle()} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">すべての状態</option>
              {['要対応', '注意', '順調', '計画中', '完了'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Btn kind="ghost" size="sm" icon={Icon.filter()}
              onClick={() => { setFilterSmallCat(''); setFilterStatus(''); setSearchText('') }}>
              クリア
            </Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.borderSoft}` }}>
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, flexShrink: 0 }}>カテゴリ:</span>
            <CategoryLegend />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.muted, fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.muted, fontSize: 13 }}>
            {events.length === 0 ? 'イベントがまだ登録されていません' : 'フィルター条件に一致するイベントがありません'}
          </div>
        ) : view === 'card' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {filtered.map(ev => {
              const children  = (childMap[ev.id] || []).sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
              const isParentEv = children.length > 0
              const allIds    = isParentEv ? [ev.id, ...children.map(c => c.id)] : [ev.id]
              const allEvTasks = tasks.filter(t => allIds.includes(t.event_id))
              const completedTasks = allEvTasks.filter(t => t.status === '完了').length
              const progress  = allEvTasks.length > 0 ? Math.round((completedTasks / allEvTasks.length) * 100) : null
              const catKey    = getEventCatKey(ev.small_cat)
              const catDef    = CAT_DEFS[catKey]
              const path      = [ev.big_cat, ev.mid_cat, ev.small_cat].filter(Boolean).join(' › ')

              return (
                <div key={ev.id} style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}
                  onClick={() => navigate(`/events/${ev.id}`)}>

                  {/* 上端カテゴリ色バー */}
                  <div style={{ height: 3, background: catDef?.color || T.border, flexShrink: 0 }} />

                  <div style={{ padding: '16px 18px 14px', flex: 1 }}>
                    {/* CategoryChip + 親バッジ + ステータスバッジ */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CategoryChip cat={catKey} size="sm" />
                        {isParentEv && <Badge tone="neutral" size="xs">親</Badge>}
                      </div>
                      {!isParentEv && <Badge tone={eventStatusTone(ev.status)} dot>{ev.status || '—'}</Badge>}
                    </div>

                    {/* タイトル */}
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6, lineHeight: 1.4 }}>{ev.name}</h4>

                    {/* パンくず */}
                    <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {path || '—'}
                    </p>

                    {/* 開催日・会場 */}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: T.inkSoft }}>
                      <span><span style={{ color: T.muted }}>開催:</span> {formatDate(ev.event_date)}</span>
                      {ev.venue && <span><span style={{ color: T.muted }}>会場:</span> {ev.venue}</span>}
                    </div>

                    {/* タスク進捗バー */}
                    {progress !== null && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>タスク進捗{isParentEv ? '（全体）' : ''}</span>
                          <span style={{ fontSize: 11, color: T.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                        </div>
                        <div style={{ height: 6, background: T.borderSoft, borderRadius: 99 }}>
                          <div style={{ width: `${Math.max(progress, 2)}%`, height: '100%', background: catDef?.color || T.teal, borderRadius: 99 }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 子イベントエリア */}
                  {isParentEv && (
                    <div style={{ background: T.surfaceAlt, padding: '8px 14px', borderTop: `1px solid ${T.borderSoft}` }}>
                      {children.map((child, ci) => {
                        const childTasks = tasks.filter(t => t.event_id === child.id)
                        const mini = childMiniStatus(child, childTasks, today)
                        return (
                          <div key={child.id}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', gap: 8, borderBottom: ci < children.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}
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
        ) : (
          <AnnualGantt events={filtered} tasks={tasks} childMap={childMap} onEventClick={id => navigate(`/events/${id}`)} />
        )}
      </div>
    </div>
  )
}

function AnnualGantt({ events, tasks, childMap = {}, onEventClick }) {
  const today = new Date()
  const fiscalYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
  const monthYear = (i) => i < 9 ? fiscalYear : fiscalYear + 1

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
      <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '40px', textAlign: 'center', color: T.muted, fontSize: 13 }}>
        表示できるイベントがありません
      </div>
    )
  }

  return (
    <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', padding: '24px 28px', overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 10 }}>
          {fiscalYear}年度（{fiscalYear}年4月 〜 {fiscalYear + 1}年3月）
        </div>
        {/* 月ラベル */}
        <div style={{ display: 'flex', marginBottom: 4 }}>
          <div style={{ width: NAME_W, flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex' }}>
            {MONTHS.map((m, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                {m === 1 && <div style={{ fontSize: 9, color: T.muted, fontWeight: 700, lineHeight: 1 }}>{fiscalYear + 1}</div>}
                <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.8 }}>{m}月</div>
              </div>
            ))}
          </div>
        </div>
        {/* イベント行 */}
        <div>
          {eventData.map((ev) => {
            const isNennen = ev.event_date === '通年'
            const eventPos = getEventPos(ev.event_date)
            const catKey = getEventCatKey(ev.small_cat)
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
                {/* ガントバー */}
                <div style={{ flex: 1, height: ev.indented ? 26 : 32, position: 'relative', background: ev.isParentRow ? '#f0f9ff' : 'transparent', borderRadius: 3, display: 'flex', alignItems: 'center' }}>
                  {/* 月グリッド線 */}
                  {MONTHS.map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${(i / 12) * 100}%`, top: 0, bottom: 0, width: 1, background: T.borderSoft }} />
                  ))}
                  {/* 今日ライン */}
                  {todayPos != null && (
                    <div style={{ position: 'absolute', left: `${todayPos}%`, top: 0, bottom: 0, width: 1.5, background: T.danger, zIndex: 2 }} />
                  )}
                  {/* イベントドット or 通年バー */}
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
