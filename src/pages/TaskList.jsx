import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { updateById } from '../api/sheets'
import { T } from '../constants/theme'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Badge, { taskStatusTone } from '../components/Badge'
import CategoryChip, { getEventCatKey } from '../components/CategoryChip'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const TASK_STATUSES = ['未着手', '進行中', '完了']

const th = { padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }
const td = { padding: '12px 18px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

const selectStyle = {
  fontSize: 12, fontFamily: 'inherit', color: T.ink,
  border: `1px solid ${T.border}`, borderRadius: 6,
  padding: '7px 10px', background: T.surface, outline: 'none',
}

function priorityTone(p) {
  if (p === '高') return 'danger'
  if (p === '中') return 'warning'
  return 'neutral'
}

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
  const [filterEvent,  setFilterEvent ] = useState('')
  const [filterOverdue, setFilterOverdue] = useState(false)

  const eventMap = useMemo(() =>
    Object.fromEntries(events.map(e => [e.id, { name: e.name, small_cat: e.small_cat }])),
  [events])

  const tasksWithStatus = useMemo(() =>
    tasks.map(t => {
      const ev = eventMap[t.event_id]
      return {
        ...t,
        _isOverdue: t.status !== '完了' && t.due_date && t.due_date < today,
        _isSoon:    t.status !== '完了' && t.due_date && t.due_date >= today && t.due_date <= in3Days,
        _eventName: ev?.name || '—',
        _catKey:    getEventCatKey(ev?.small_cat),
      }
    }),
  [tasks, eventMap, today, in3Days])

  const filtered = useMemo(() => tasksWithStatus.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false
    if (filterEvent && t.event_id !== filterEvent) return false
    if (filterOverdue && !t._isOverdue) return false
    return true
  }), [tasksWithStatus, filterStatus, filterEvent, filterOverdue])

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
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
  const hasFilter    = filterStatus || filterEvent || filterOverdue

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>タスク一覧</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="タスク一覧"
          subtitle="全イベントのタスクを横断的に管理します。期限超過・直近のタスクが上部に表示されます。"
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              {overdueCount > 0 && (
                <button
                  onClick={() => setFilterOverdue(v => !v)}
                  style={{
                    fontSize: 12, padding: '6px 14px', borderRadius: 999, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: filterOverdue ? T.danger : T.dangerBg,
                    color: filterOverdue ? '#fff' : T.dangerText,
                    border: `1px solid ${T.danger}44`,
                  }}>
                  期限超過 {overdueCount}件
                </button>
              )}
              {soonCount > 0 && (
                <span style={{ fontSize: 12, padding: '6px 14px', borderRadius: 999, fontWeight: 600, background: T.warningBg, color: T.warningText, border: `1px solid ${T.warning}44` }}>
                  3日以内 {soonCount}件
                </span>
              )}
            </div>
          }
        />

        {/* フィルターカード */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...selectStyle, width: 140 }}>
            <option value="">すべての状態</option>
            {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ ...selectStyle, maxWidth: 280 }}>
            <option value="">すべてのイベント</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          {hasFilter && (
            <button onClick={() => { setFilterStatus(''); setFilterEvent(''); setFilterOverdue(false) }}
              style={{ fontSize: 12, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              クリア
            </button>
          )}
          <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{sorted.length}件 / {tasks.length}件</span>
        </div>

        {/* テーブル */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>読み込み中...</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>タスクがありません</div>
        ) : (
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.borderSoft}` }}>
                  <th style={th}>タスク名</th>
                  <th style={{ ...th, maxWidth: 160 }}>イベント</th>
                  <th style={{ ...th, width: 110 }}>カテゴリ</th>
                  <th style={{ ...th, width: 110 }}>期日</th>
                  <th style={{ ...th, width: 60 }}>優先</th>
                  <th style={{ ...th, width: 120 }}>ステータス</th>
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.id} style={{
                    borderTop: `1px solid ${T.borderSoft}`,
                    background: t._isOverdue ? T.dangerBg : t._isSoon ? T.warningBg : 'transparent',
                  }}>
                    <td style={{ ...td, fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>
                      {t.name}
                    </td>
                    <td style={{ ...td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={t._eventName}>
                      <span style={{ color: T.teal, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                        onClick={() => navigate(`/events/${t.event_id}`)}>
                        {t._eventName}
                      </span>
                    </td>
                    <td style={{ ...td }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CategoryChip cat={t._catKey} size="sm" />
                        {t.category && <span style={{ fontSize: 11, color: T.inkSoft }}>{t.category}</span>}
                      </div>
                    </td>
                    <td style={{ ...td, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: t._isOverdue ? T.danger : t._isSoon ? T.warning : T.ink, fontWeight: (t._isOverdue || t._isSoon) ? 700 : 400 }}>
                      {formatDate(t.due_date)}
                    </td>
                    <td style={td}>
                      {t.priority
                        ? <Badge tone={priorityTone(t.priority)} size="xs">{t.priority}</Badge>
                        : <span style={{ color: T.faint }}>—</span>}
                    </td>
                    <td style={td}>
                      <select value={t.status} onChange={e => handleStatusChange(t, e.target.value)}
                        style={{ fontSize: 12, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: '3px 8px', background: T.surface, outline: 'none' }}>
                        {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <button onClick={() => navigate(`/events/${t.event_id}`)}
                        style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
