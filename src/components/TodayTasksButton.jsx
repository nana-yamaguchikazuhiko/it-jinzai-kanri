import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { T } from '../constants/theme'
import TodayTasksPanel, { categorizeTasks } from './TodayTasksPanel'

export default function TodayTasksButton() {
  const navigate = useNavigate()
  const { rows: tasks } = useSheets('tasks')
  const { rows: events } = useSheets('events')

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const today = new Date().toISOString().split('T')[0]

  const urgentCount = useMemo(() => {
    const items = categorizeTasks(tasks, today)
    return items.filter(t => t._cat === 'overdue' || t._cat === 'dueToday').length
  }, [tasks, today])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="本日のタスク提案"
        style={{
          height: 36, borderRadius: 8, border: `1px solid ${open ? T.teal : T.border}`,
          background: open ? T.tealBg : T.surface, color: open ? T.teal : T.inkSoft,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '0 10px', cursor: 'pointer', transition: 'all 0.15s',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit', position: 'relative',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>📋</span>
        本日のタスク
        {urgentCount > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            minWidth: 17, height: 17, borderRadius: 999,
            background: T.danger, border: `2px solid ${T.surface}`,
            color: '#fff', fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', fontVariantNumeric: 'tabular-nums',
          }}>
            {urgentCount > 99 ? '99+' : urgentCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          width: 440, background: T.surface,
          border: `1px solid ${T.border}`, borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.13)', zIndex: 200,
          overflow: 'hidden', maxHeight: 520, overflowY: 'auto',
        }}>
          <TodayTasksPanel
            tasks={tasks}
            events={events}
            navigate={(path) => { navigate(path); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}
