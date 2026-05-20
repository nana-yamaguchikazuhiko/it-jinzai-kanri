import { useState, useMemo } from 'react'
import { T } from '../constants/theme'

const PAGE_SIZE = 10

function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export const TASK_CATS = [
  { key: 'overdue',     label: '期限超過・要対応',  dot: T.danger,   bg: T.dangerBg,  fg: T.danger },
  { key: 'dueToday',   label: '今日が期日',         dot: '#f97316',  bg: '#fff7ed',   fg: '#c2410c' },
  { key: 'soon',       label: '3日以内に期日',      dot: T.warning,  bg: T.warningBg, fg: T.warningText },
  { key: 'startToday', label: '今日から開始予定',   dot: '#3b82f6',  bg: '#eff6ff',   fg: '#1d4ed8' },
  { key: 'forgotten',  label: '着手し忘れてない？', dot: '#8b5cf6',  bg: '#f5f3ff',   fg: '#6d28d9' },
  { key: 'inProgress', label: '進行中タスクを確認', dot: T.teal,     bg: T.tealBg,    fg: T.teal },
]

export function categorizeTasks(tasks, today) {
  const in3 = addDays(today, 3)
  const result = []
  const used = new Set()
  const push = (t, key) => { result.push({ ...t, _cat: key }); used.add(t.id) }

  tasks.filter(t => t.status !== '完了' && t.due_date && t.due_date < today)
    .forEach(t => push(t, 'overdue'))
  tasks.filter(t => !used.has(t.id) && t.status !== '完了' && t.due_date === today)
    .forEach(t => push(t, 'dueToday'))
  tasks.filter(t => !used.has(t.id) && t.status !== '完了' && t.due_date > today && t.due_date <= in3)
    .forEach(t => push(t, 'soon'))
  tasks.filter(t => !used.has(t.id) && t.status === '未着手' && t.start_date === today)
    .forEach(t => push(t, 'startToday'))
  tasks.filter(t => !used.has(t.id) && t.status === '未着手' && t.start_date && t.start_date < today)
    .forEach(t => push(t, 'forgotten'))
  tasks.filter(t => !used.has(t.id) && t.status === '進行中')
    .forEach(t => push(t, 'inProgress'))

  return result
}

function formatDate(d) {
  if (!d) return ''
  return d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1/$2/$3')
}

function TaskRow({ t, catMap, eventMap, navigate, borderBottom }) {
  const cat = catMap[t._cat]
  return (
    <div
      onClick={() => navigate(`/events/${t.event_id}`)}
      style={{
        padding: '10px 16px',
        borderBottom: borderBottom ? `1px solid ${T.borderSoft}` : 'none',
        background: cat.bg, cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: cat.fg, flexShrink: 0 }}>{cat.label}</span>
        {t.due_date && (
          <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto', flexShrink: 0 }}>
            期日: {formatDate(t.due_date)}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t.name}
      </div>
      {eventMap[t.event_id] && (
        <div style={{ fontSize: 11, color: T.inkSoft, paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {eventMap[t.event_id]}
        </div>
      )}
    </div>
  )
}

export default function TodayTasksPanel({ tasks, events, navigate }) {
  const [page, setPage] = useState(0)
  const [showInProgress, setShowInProgress] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  const eventMap = useMemo(
    () => Object.fromEntries(events.map(e => [e.id, e.name])),
    [events]
  )

  const categorized = useMemo(() => categorizeTasks(tasks, today), [tasks, today])

  const mainItems = useMemo(() => categorized.filter(t => t._cat !== 'inProgress'), [categorized])
  const inProgressItems = useMemo(() => categorized.filter(t => t._cat === 'inProgress'), [categorized])

  const totalPages = Math.ceil(mainItems.length / PAGE_SIZE)
  const pageItems = mainItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const catMap = Object.fromEntries(TASK_CATS.map(c => [c.key, c]))

  const inProgressCat = TASK_CATS.find(c => c.key === 'inProgress')

  return (
    <div>
      {/* 日付ヘッダー */}
      <div style={{
        padding: '12px 16px', borderBottom: `1px solid ${T.borderSoft}`,
        background: T.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{todayLabel}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            {mainItems.length === 0 && inProgressItems.length === 0
              ? '対応タスクなし'
              : `${mainItems.length}件の提案${inProgressItems.length > 0 ? `・進行中 ${inProgressItems.length}件` : ''}`}
          </div>
        </div>
        {/* 凡例 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'flex-end', maxWidth: 260 }}>
          {TASK_CATS.filter(c => c.key !== 'inProgress').map(c => (
            <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.muted }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* メインタスクリスト */}
      {mainItems.length === 0 && inProgressItems.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: T.muted }}>
          本日対応すべきタスクはありません 🎉
        </div>
      ) : (
        <>
          {mainItems.length > 0 && (
            <div>
              {pageItems.map((t, i) => (
                <TaskRow key={t.id} t={t} catMap={catMap} eventMap={eventMap} navigate={navigate}
                  borderBottom={i < pageItems.length - 1} />
              ))}
            </div>
          )}

          {/* ページネーション */}
          {totalPages > 1 && (
            <div style={{
              padding: '10px 16px', borderTop: `1px solid ${T.borderSoft}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.surfaceAlt,
            }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 4,
                  border: `1px solid ${T.border}`, background: T.surface,
                  cursor: page === 0 ? 'default' : 'pointer',
                  color: page === 0 ? T.muted : T.ink,
                  opacity: page === 0 ? 0.4 : 1, fontFamily: 'inherit',
                }}>← 前へ</button>
              <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                {page + 1} / {totalPages} ページ（{mainItems.length}件）
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                style={{
                  fontSize: 11, padding: '4px 12px', borderRadius: 4,
                  border: `1px solid ${T.border}`, background: T.surface,
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                  color: page >= totalPages - 1 ? T.muted : T.ink,
                  opacity: page >= totalPages - 1 ? 0.4 : 1, fontFamily: 'inherit',
                }}>次へ →</button>
            </div>
          )}

          {/* 進行中タスク（折りたたみ） */}
          {inProgressItems.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.borderSoft}` }}>
              <button
                onClick={() => setShowInProgress(v => !v)}
                style={{
                  width: '100%', padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: showInProgress ? T.tealBg : T.surfaceAlt,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: showInProgress ? `1px solid ${T.borderSoft}` : 'none',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: inProgressCat.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: inProgressCat.fg, flex: 1, textAlign: 'left' }}>
                  進行中タスクを確認
                </span>
                <span style={{ fontSize: 11, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                  {inProgressItems.length}件
                </span>
                <span style={{ fontSize: 11, color: T.teal, marginLeft: 4 }}>
                  {showInProgress ? '▲ 閉じる' : '▼ 開く'}
                </span>
              </button>
              {showInProgress && inProgressItems.map((t, i) => (
                <TaskRow key={t.id} t={t} catMap={catMap} eventMap={eventMap} navigate={navigate}
                  borderBottom={i < inProgressItems.length - 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
