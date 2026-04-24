import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import AlertBanner from '../components/AlertBanner'
import { TaskStatusBadge } from '../components/StatusBadge'

// 今日の日付（YYYY-MM-DD）
function today() {
  return new Date().toISOString().split('T')[0]
}

// N日後の日付（YYYY-MM-DD）
function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
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

    // 進行中イベント
    const activeEvents = events.filter(e => !['完了'].includes(e.status))

    // 期限超過タスク（未完了 & 期日 < 今日）
    const incompleteTasks = tasks.filter(t => t.status !== '完了' && t.status !== '期限超過')
    const overdueTasks = tasks.filter(t =>
      t.status !== '完了' && t.due_date && t.due_date < todayStr
    )
    const soonTasks = tasks.filter(t =>
      t.status !== '完了' && t.due_date && t.due_date >= todayStr && t.due_date <= in3DaysStr
    )
    const uncompletedTaskCount = tasks.filter(t => t.status !== '完了').length

    // 連絡待ちSH（未連絡 or 連絡中）
    const waitingSH = stakeholders.filter(s =>
      s.contact_status === '未連絡' || s.contact_status === '連絡中'
    )

    // 年間目標達成率（開催回数ベース、全小分類合計）
    const totalGoal = goals.reduce((sum, g) => sum + (Number(g.hold_count_goal) || 0), 0)
    const currentYear = new Date().getFullYear()
    const completedEvents = events.filter(e => e.status === '完了')
    const achieveRate = totalGoal > 0
      ? Math.round((completedEvents.length / totalGoal) * 100)
      : 0

    // 期限の近いタスク上位8件（期日昇順）
    const upcomingTasks = tasks
      .filter(t => t.status !== '完了' && t.due_date)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 8)
      .map(t => ({
        ...t,
        eventName: events.find(e => e.id === t.event_id)?.name || '—',
        isOverdue: t.due_date < todayStr,
        isSoon: t.due_date >= todayStr && t.due_date <= in3DaysStr,
      }))

    // 小分類別達成率
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
      overdueCount: overdueTasks.length,
      soonCount: soonTasks.length,
      achieveRate,
      waitingSHCount: waitingSH.length,
      upcomingTasks,
      smallCatStats,
    }
  }, [events, tasks, stakeholders, goals, results, loading])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">データを読み込んでいます...</div>
      </div>
    )
  }

  return (
    <div>
      <AlertBanner
        overdueTasks={stats?.overdueCount || 0}
        soonTasks={stats?.soonCount || 0}
      />

      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6">ダッシュボード</h1>

        {/* 統計カード */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="進行中イベント"
            value={stats?.activeEventCount ?? '—'}
            color="blue"
          />
          <StatCard
            label="未完了タスク"
            value={stats?.uncompletedTaskCount ?? '—'}
            sub={stats?.overdueCount > 0 ? `うち超過 ${stats.overdueCount}件` : ''}
            subColor="red"
            color="gray"
          />
          <StatCard
            label="年間目標達成率"
            value={`${stats?.achieveRate ?? 0}%`}
            color="green"
          />
          <StatCard
            label="連絡待ちSH"
            value={stats?.waitingSHCount ?? '—'}
            color="yellow"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 期限の近いタスク */}
          <div className="col-span-2 bg-white rounded-lg shadow-sm border border-gray-100">
            <div
              className="px-4 py-3 rounded-t-lg text-white text-sm font-semibold"
              style={{ background: '#0f1c2e' }}
            >
              期限が近いタスク
            </div>
            <div className="overflow-x-auto">
              {stats?.upcomingTasks?.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">期限が近いタスクはありません</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">タスク名</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">イベント</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">期日</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.upcomingTasks.map(t => (
                      <tr
                        key={t.id}
                        className={`border-b border-gray-50 ${t.isOverdue ? 'bg-red-50' : t.isSoon ? 'bg-yellow-50' : ''}`}
                      >
                        <td className="px-4 py-2.5 font-medium">{t.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{t.eventName}</td>
                        <td className={`px-4 py-2.5 text-xs font-mono ${t.isOverdue ? 'text-red-600 font-bold' : t.isSoon ? 'text-yellow-600 font-bold' : ''}`}>
                          {formatDate(t.due_date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <TaskStatusBadge status={t.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 小分類達成率 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div
              className="px-4 py-3 rounded-t-lg text-white text-sm font-semibold"
              style={{ background: '#0f1c2e' }}
            >
              小分類別達成率
            </div>
            <div className="p-4 space-y-3">
              {Object.keys(stats?.smallCatStats || {}).length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-4">目標データがありません</p>
              ) : (
                Object.entries(stats.smallCatStats).map(([name, { goal, actual }]) => {
                  const pct = goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span className="truncate max-w-[140px]" title={name}>{name}</span>
                        <span>{actual}/{goal}件 ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: '#06b6d4' }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, subColor = 'gray', color = 'gray' }) {
  const colorMap = {
    blue:   { bg: 'bg-blue-50',   val: 'text-blue-700',   border: 'border-blue-100' },
    green:  { bg: 'bg-green-50',  val: 'text-green-700',  border: 'border-green-100' },
    yellow: { bg: 'bg-yellow-50', val: 'text-yellow-700', border: 'border-yellow-100' },
    gray:   { bg: 'bg-white',     val: 'text-gray-800',   border: 'border-gray-100' },
    red:    { bg: 'bg-red-50',    val: 'text-red-700',    border: 'border-red-100' },
  }
  const subColorMap = {
    red: 'text-red-500',
    gray: 'text-gray-400',
  }
  const c = colorMap[color] || colorMap.gray
  return (
    <div className={`${c.bg} border ${c.border} rounded-lg p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${c.val}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColorMap[subColor] || 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}
