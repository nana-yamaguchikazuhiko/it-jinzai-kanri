import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { updateById } from '../api/sheets'
import { T } from '../constants/theme'
import { Icon } from './Icons'

function addDays(base, n) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const LEVEL = {
  critical: { label: '超危険', dot: T.danger,   fg: T.danger,         bg: T.dangerBg  },
  danger:   { label: '危険',   dot: T.warning,  fg: T.warningText,    bg: T.warningBg },
  warning:  { label: '着手しよう', dot: '#d97706', fg: '#92400e', bg: '#fffbeb' },
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { rows: tasks, reload } = useSheets('tasks')
  const { rows: events }        = useSheets('events')

  const [open,     setOpen    ] = useState(false)
  const [updating, setUpdating] = useState(null)
  const ref = useRef(null)

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const eventMap = useMemo(() =>
    Object.fromEntries(events.map(e => [e.id, e.name]))
  , [events])

  const alerts = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const in3   = addDays(today, 3)
    const in7   = addDays(today, 7)
    const list  = []

    tasks.forEach(t => {
      if (t.status !== '未着手') return   // 未着手以外はすべて対象外

      // 超危険: 期日が3日以内（期日超過も含む）
      if (t.due_date && t.due_date <= in3) {
        const daysLeft = Math.ceil((new Date(t.due_date) - new Date(today)) / 864e5)
        list.push({
          id: t.id, task: t,
          level: 'critical',
          message: daysLeft < 0 ? `期日を${Math.abs(daysLeft)}日超過` : `期日まで${daysLeft}日`,
          resolveStatus: '完了',
          resolveLabel: '完了にする',
          eventName: eventMap[t.event_id] || '',
        })
        return
      }

      // 危険: 期日が4〜7日以内
      if (t.due_date && t.due_date <= in7) {
        const daysLeft = Math.ceil((new Date(t.due_date) - new Date(today)) / 864e5)
        list.push({
          id: t.id, task: t,
          level: 'danger',
          message: `期日まで${daysLeft}日`,
          resolveStatus: '進行中',
          resolveLabel: '進行中にする',
          eventName: eventMap[t.event_id] || '',
        })
        return
      }

      // 着手しよう: 開始日を1日以上過ぎている
      if (t.start_date && t.start_date < today) {
        const daysPast = Math.ceil((new Date(today) - new Date(t.start_date)) / 864e5)
        list.push({
          id: t.id, task: t,
          level: 'warning',
          message: `開始日から${daysPast}日経過`,
          resolveStatus: '進行中',
          resolveLabel: '進行中にする',
          eventName: eventMap[t.event_id] || '',
        })
      }
    })

    // 重篤度順にソート
    const order = { critical: 0, danger: 1, warning: 2 }
    return list.sort((a, b) => order[a.level] - order[b.level])
  }, [tasks, eventMap])

  const handleResolve = async (alert, e) => {
    e.stopPropagation()
    setUpdating(alert.id)
    try {
      await updateById('tasks', alert.id, { ...alert.task, status: alert.resolveStatus })
      await reload()
    } catch (err) { window.alert('更新失敗: ' + err.message) }
    finally { setUpdating(null) }
  }

  const count = alerts.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* ベルボタン */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${open ? T.teal : T.border}`,
          background: open ? T.tealBg : T.surface, color: open ? T.teal : T.inkSoft,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {Icon.bell(16)}
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            minWidth: 17, height: 17, borderRadius: 999,
            background: T.danger, border: `2px solid ${T.surface}`,
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', fontVariantNumeric: 'tabular-nums',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          width: 380, background: T.surface,
          border: `1px solid ${T.border}`, borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.13)', zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* ヘッダー */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${T.borderSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: T.surfaceAlt,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>タスクアラート</span>
            <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
              {count === 0 ? '問題なし' : `${count}件`}
            </span>
          </div>

          {/* リスト */}
          {count === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 13, color: T.muted }}>アラートはありません</div>
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {alerts.map((alert, i) => {
                const lv = LEVEL[alert.level]
                const isUpdating = updating === alert.id
                return (
                  <div
                    key={alert.id}
                    onClick={() => { navigate(`/events/${alert.task.event_id}`); setOpen(false) }}
                    style={{
                      padding: '11px 16px',
                      borderBottom: i < alerts.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
                      background: lv.bg, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 5,
                    }}
                  >
                    {/* 1行目: レベル・メッセージ・ボタン */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: lv.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: lv.fg, flexShrink: 0 }}>{lv.label}</span>
                      <span style={{ fontSize: 11, color: T.muted, flex: 1 }}>{alert.message}</span>
                      <button
                        onClick={e => handleResolve(alert, e)}
                        disabled={isUpdating}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 4, fontFamily: 'inherit',
                          border: `1px solid ${lv.dot}66`, background: T.surface,
                          color: lv.fg, fontWeight: 600, cursor: isUpdating ? 'wait' : 'pointer',
                          opacity: isUpdating ? 0.5 : 1, flexShrink: 0, whiteSpace: 'nowrap',
                        }}
                      >
                        {isUpdating ? '更新中...' : alert.resolveLabel}
                      </button>
                    </div>

                    {/* 2行目: タスク名 */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, paddingLeft: 12,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alert.task.name}
                    </div>

                    {/* 3行目: イベント名 */}
                    {alert.eventName && (
                      <div style={{ fontSize: 11, color: T.inkSoft, paddingLeft: 12,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.eventName}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
