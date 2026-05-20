import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import AlertBanner from '../components/AlertBanner'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Badge, { taskStatusTone } from '../components/Badge'
import CategoryChip, { getEventCatKey } from '../components/CategoryChip'
import TodayTasksPanel from '../components/TodayTasksPanel'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'

function today() { return new Date().toISOString().split('T')[0] }
function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { rows: events, loading: eventsLoading } = useSheets('events')
  const { rows: tasks,  loading: tasksLoading  } = useSheets('tasks')
  const { rows: stakeholders, loading: shLoading } = useSheets('stakeholders')
  const { rows: goals,   loading: goalsLoading  } = useSheets('goals')
  const { rows: results, loading: resultsLoading } = useSheets('results')

  const loading = eventsLoading || tasksLoading || shLoading || goalsLoading || resultsLoading

  const todayStr   = today()
  const in3DaysStr = daysFromNow(3)

  const stats = useMemo(() => {
    if (loading) return null

    const activeEvents     = events.filter(e => !['完了'].includes(e.status))
    const overdueTasks     = tasks.filter(t => t.status !== '完了' && t.due_date && t.due_date < todayStr)
    const soonTasks        = tasks.filter(t => t.status !== '完了' && t.due_date && t.due_date >= todayStr && t.due_date <= in3DaysStr)
    const uncompletedTaskCount = tasks.filter(t => t.status !== '完了').length
    const waitingSH        = stakeholders.filter(s => s.contact_status === '未連絡' || s.contact_status === '連絡中')
    const totalGoal        = goals.reduce((sum, g) => sum + (Number(g.hold_count_goal) || 0), 0)
    const completedEvents  = events.filter(e => e.status === '完了')
    const achieveRate      = totalGoal > 0 ? Math.round((completedEvents.length / totalGoal) * 100) : 0

    const upcomingTasks = tasks
      .filter(t => t.status !== '完了' && t.due_date)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 8)
      .map(t => ({
        ...t,
        eventName: events.find(e => e.id === t.event_id)?.name || '—',
        smallCat:  events.find(e => e.id === t.event_id)?.small_cat || '',
        isOverdue: t.due_date < todayStr,
        isSoon:    t.due_date >= todayStr && t.due_date <= in3DaysStr,
      }))

    const smallCatStats = {}
    goals.forEach(g => {
      const key = g.small_cat
      if (!smallCatStats[key]) smallCatStats[key] = { goal: 0, actual: 0 }
      smallCatStats[key].goal += Number(g.hold_count_goal) || 0
    })
    completedEvents.forEach(e => {
      const key = e.small_cat
      if (!smallCatStats[key]) smallCatStats[key] = { goal: 0, actual: 0 }
      smallCatStats[key].actual += 1
    })

    return {
      activeEventCount: activeEvents.length,
      uncompletedTaskCount,
      overdueCount:  overdueTasks.length,
      soonCount:     soonTasks.length,
      achieveRate,
      waitingSHCount: waitingSH.length,
      upcomingTasks,
      smallCatStats,
      totalGoal,
      totalActual: completedEvents.length,
    }
  }, [events, tasks, stakeholders, goals, results, loading])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
        <TopBar><span>ダッシュボード</span></TopBar>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.muted, fontSize: 13 }}>
          データを読み込んでいます...
        </div>
      </div>
    )
  }

  const thStyle = { padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }
  const tdStyle = { padding: '12px 18px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>ダッシュボード</span></TopBar>

      <AlertBanner
        overdueTasks={stats?.overdueCount || 0}
        soonTasks={stats?.soonCount || 0}
        onConfirm={() => navigate('/tasks')}
      />

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="ダッシュボード"
          subtitle="本日の概況とアクションが必要なタスクを確認"
        />

        {/* KPIカード 4枚 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
          {[
            { label: '進行中イベント', value: stats?.activeEventCount ?? '—', sub: `全${events.length}件`, icon: Icon.event, iconColor: T.teal },
            { label: '未完了タスク',   value: stats?.uncompletedTaskCount ?? '—', sub: stats?.overdueCount > 0 ? `うち期限超過 ${stats.overdueCount}件` : '期限超過なし', icon: Icon.task, iconColor: T.muted },
            { label: '年間目標達成率', value: `${stats?.achieveRate ?? 0}%`, sub: `${stats?.totalActual || 0} / ${stats?.totalGoal || 0}回`, progress: stats?.achieveRate ?? 0 },
            { label: '連絡待ちSH',     value: stats?.waitingSHCount ?? '—', sub: '返信待ち', icon: Icon.users, iconColor: T.muted },
          ].map((s, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: 4, padding: '18px 20px', border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>{s.label}</span>
                {s.icon && (
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: T.surfaceAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: s.iconColor }}>
                    {s.icon(14)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>{s.sub}</div>
              {s.progress != null && (
                <div style={{ height: 4, background: T.borderSoft, borderRadius: 99, overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ width: `${Math.max(s.progress, 2)}%`, height: '100%', background: T.warning }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 本日のタスク提案 */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '14px 22px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.surfaceAlt }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>本日のタスク提案</h3>
          </div>
          <TodayTasksPanel tasks={tasks} events={events} navigate={navigate} />
        </div>

        {/* 2カラム下段 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>

          {/* 期限が近いタスク */}
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderSoft}` }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
                期限が近いタスク
                <span style={{ color: T.muted, marginLeft: 6, fontWeight: 500 }}>{stats?.upcomingTasks?.length || 0}件</span>
              </h3>
              <button
                onClick={() => navigate('/tasks')}
                style={{ background: 'transparent', border: 'none', color: T.teal, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                すべて表示 {Icon.chevR(12)}
              </button>
            </div>
            {stats?.upcomingTasks?.length === 0 ? (
              <p style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '32px 0' }}>期限が近いタスクはありません</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt }}>
                    <th style={thStyle}>タスク名</th>
                    <th style={thStyle}>イベント</th>
                    <th style={{ ...thStyle, width: 110 }}>期日</th>
                    <th style={{ ...thStyle, width: 110 }}>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcomingTasks.map(t => (
                    <tr key={t.id} style={{ borderTop: `1px solid ${T.borderSoft}`, background: t.isOverdue ? '#fffbeb' : 'transparent' }}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CategoryChip cat={getEventCatKey(t.smallCat)} size="sm" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{t.name}</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: T.inkSoft, fontSize: 12 }}>{t.eventName}</td>
                      <td style={{ ...tdStyle, fontSize: 12, color: t.isOverdue ? T.danger : T.inkSoft, fontWeight: t.isOverdue ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(t.due_date)}
                      </td>
                      <td style={tdStyle}>
                        <Badge tone={taskStatusTone(t.status)} dot>{t.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 小分類別達成率 */}
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderSoft}` }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>小分類別 達成率</h3>
              <span style={{ fontSize: 11, color: T.muted }}>{new Date().getFullYear()}年度</span>
            </div>
            {Object.keys(stats?.smallCatStats || {}).length === 0 ? (
              <p style={{ textAlign: 'center', color: T.muted, fontSize: 13, padding: '32px 0' }}>目標データがありません</p>
            ) : (
              <div style={{ padding: '8px 0' }}>
                {Object.entries(stats.smallCatStats).map(([name, { goal, actual }], i, arr) => {
                  const pct = goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0
                  return (
                    <div key={name} style={{ padding: '10px 22px', borderBottom: i < arr.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }} title={name}>{name}</span>
                        <span style={{ fontSize: 11, color: T.inkSoft, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          <strong style={{ color: T.ink, fontWeight: 700 }}>{actual}</strong>
                          <span style={{ color: T.muted }}> / {goal}</span>
                          <span style={{ color: T.muted, marginLeft: 6 }}>({pct}%)</span>
                        </span>
                      </div>
                      <div style={{ height: 4, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(pct, 2)}%`, height: '100%', background: pct > 0 ? T.teal : T.borderSoft }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
