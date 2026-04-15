import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'
import { ALL_SMALL_CATS } from '../constants/categories'

const CURRENT_YEAR = new Date().getFullYear()
const FISCAL_YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function GoalManagement() {
  const { rows: goals, reload: reloadGoals, loading: goalsLoading } = useSheets('goals')
  const { rows: events } = useSheets('events')
  const { rows: results } = useSheets('results')

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // 年度 × 小分類の目標データ
  const yearGoals = useMemo(() =>
    goals.filter(g => String(g.fiscal_year) === String(selectedYear)),
  [goals, selectedYear])

  // 小分類ごとの実績（完了イベントの参加実数を集計）
  const actuals = useMemo(() => {
    const map = {}
    const completedEvents = events.filter(e => e.status === '完了')
    completedEvents.forEach(ev => {
      const res = results.find(r => r.event_id === ev.id)
      if (!map[ev.small_cat]) map[ev.small_cat] = { hold_count: 0, student: 0, company: 0 }
      map[ev.small_cat].hold_count += 1
      map[ev.small_cat].student += Number(res?.student_actual || 0)
      map[ev.small_cat].company += Number(res?.company_actual || 0)
    })
    return map
  }, [events, results])

  // 全小分類 + 目標データをマージ
  const rows = useMemo(() => {
    return ALL_SMALL_CATS.map(s => {
      const goal = yearGoals.find(g => g.small_cat === s.name)
      const actual = actuals[s.name] || { hold_count: 0, student: 0, company: 0 }
      return {
        small_cat: s.name,
        bigName: s.bigName,
        midName: s.midName,
        goal_id: goal?.id || null,
        hold_count_goal: goal?.hold_count_goal || '',
        student_goal: goal?.student_goal || '',
        company_goal: goal?.company_goal || '',
        actual_hold: actual.hold_count,
        actual_student: actual.student,
        actual_company: actual.company,
      }
    })
  }, [yearGoals, actuals])

  // 合計行
  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      hold_count_goal: acc.hold_count_goal + (Number(r.hold_count_goal) || 0),
      student_goal: acc.student_goal + (Number(r.student_goal) || 0),
      company_goal: acc.company_goal + (Number(r.company_goal) || 0),
      actual_hold: acc.actual_hold + r.actual_hold,
      actual_student: acc.actual_student + r.actual_student,
      actual_company: acc.actual_company + r.actual_company,
    }), { hold_count_goal: 0, student_goal: 0, company_goal: 0, actual_hold: 0, actual_student: 0, actual_company: 0 })
  }, [rows])

  const startEdit = (row) => {
    setEditingId(row.small_cat)
    setEditForm({
      hold_count_goal: row.hold_count_goal,
      student_goal: row.student_goal,
      company_goal: row.company_goal,
    })
  }

  const handleSave = async (row) => {
    setSaving(true)
    setError(null)
    try {
      if (row.goal_id) {
        await updateById('goals', row.goal_id, {
          id: row.goal_id,
          fiscal_year: selectedYear,
          small_cat: row.small_cat,
          ...editForm,
        })
      } else {
        await appendRow('goals', [
          generateId(),
          selectedYear,
          row.small_cat,
          editForm.hold_count_goal || '',
          editForm.student_goal || '',
          editForm.company_goal || '',
        ])
      }
      await reloadGoals()
      setEditingId(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const achieveRate = (actual, goal) => {
    if (!goal || Number(goal) === 0) return null
    return Math.round((actual / Number(goal)) * 100)
  }

  const RateBar = ({ actual, goal }) => {
    const rate = achieveRate(actual, goal)
    if (rate === null) return <span className="text-gray-300">—</span>
    const color = rate >= 100 ? '#29e6d3' : rate >= 75 ? '#3b82f6' : rate >= 50 ? '#f59e0b' : '#ef4444'
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(rate, 100)}%`, background: color }} />
        </div>
        <span className="text-xs font-medium" style={{ color }}>{rate}%</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">目標・実績管理</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">年度:</label>
          <select
            className="form-select w-28"
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {FISCAL_YEARS.map(y => <option key={y} value={y}>{y}年度</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">{error}</div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '開催回数', goal: totals.hold_count_goal, actual: totals.actual_hold },
          { label: '学生参加数（延べ）', goal: totals.student_goal, actual: totals.actual_student },
          { label: '企業参加数（延べ）', goal: totals.company_goal, actual: totals.actual_company },
        ].map(({ label, goal, actual }) => {
          const rate = achieveRate(actual, goal)
          return (
            <div key={label} className="bg-white rounded-lg border border-gray-100 p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-2xl font-bold text-gray-700">
                {actual} <span className="text-sm font-normal text-gray-400">/ {goal || '未設定'}</span>
              </p>
              {rate !== null && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(rate, 100)}%`,
                        background: rate >= 100 ? '#29e6d3' : rate >= 75 ? '#3b82f6' : '#f59e0b',
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{rate}% 達成</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 小分類別テーブル */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        {goalsLoading ? (
          <p className="text-center py-8 text-gray-400 text-sm">読み込み中...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#262526' }} className="text-white text-xs">
                <th className="text-left px-4 py-2.5 w-48">小分類</th>
                <th className="text-left px-4 py-2.5 w-28">目標 (回)</th>
                <th className="text-left px-4 py-2.5 w-24">実績 (回)</th>
                <th className="text-left px-4 py-2.5 w-32">達成率</th>
                <th className="text-left px-4 py-2.5 w-28">学生目標</th>
                <th className="text-left px-4 py-2.5 w-24">学生実績</th>
                <th className="text-left px-4 py-2.5 w-28">企業目標</th>
                <th className="text-left px-4 py-2.5 w-24">企業実績</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isEditing = editingId === row.small_cat
                return (
                  <tr key={row.small_cat} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-medium">{row.small_cat}</div>
                      <div className="text-xs text-gray-400">{row.bigName}</div>
                    </td>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-1.5">
                          <input
                            type="number"
                            className="form-input text-xs py-1 w-20"
                            value={editForm.hold_count_goal}
                            onChange={e => setEditForm(p => ({ ...p, hold_count_goal: e.target.value }))}
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.actual_hold}</td>
                        <td className="px-4 py-2.5">
                          <RateBar actual={row.actual_hold} goal={editForm.hold_count_goal} />
                        </td>
                        <td className="px-4 py-1.5">
                          <input
                            type="number"
                            className="form-input text-xs py-1 w-20"
                            value={editForm.student_goal}
                            onChange={e => setEditForm(p => ({ ...p, student_goal: e.target.value }))}
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.actual_student}</td>
                        <td className="px-4 py-1.5">
                          <input
                            type="number"
                            className="form-input text-xs py-1 w-20"
                            value={editForm.company_goal}
                            onChange={e => setEditForm(p => ({ ...p, company_goal: e.target.value }))}
                            min="0"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.actual_company}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1.5">
                            <button
                              className="text-xs px-2 py-1 rounded text-gray-900 font-medium disabled:opacity-50"
                              style={{ background: '#29e6d3' }}
                              onClick={() => handleSave(row)}
                              disabled={saving}
                            >
                              保存
                            </button>
                            <button
                              className="text-xs text-gray-400 hover:text-gray-600"
                              onClick={() => setEditingId(null)}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.hold_count_goal || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.actual_hold}</td>
                        <td className="px-4 py-2.5">
                          <RateBar actual={row.actual_hold} goal={row.hold_count_goal} />
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.student_goal || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.actual_student}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.company_goal || '—'}</td>
                        <td className="px-4 py-2.5 text-center text-gray-600">{row.actual_company}</td>
                        <td className="px-4 py-2.5">
                          <button
                            className="text-xs text-blue-500 hover:underline"
                            onClick={() => startEdit(row)}
                          >
                            編集
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              {/* 合計行 */}
              <tr className="bg-gray-50 font-semibold text-sm border-t-2 border-gray-200">
                <td className="px-4 py-2.5 text-gray-700">合計</td>
                <td className="px-4 py-2.5 text-center">{totals.hold_count_goal || '—'}</td>
                <td className="px-4 py-2.5 text-center">{totals.actual_hold}</td>
                <td className="px-4 py-2.5">
                  <RateBar actual={totals.actual_hold} goal={totals.hold_count_goal} />
                </td>
                <td className="px-4 py-2.5 text-center">{totals.student_goal || '—'}</td>
                <td className="px-4 py-2.5 text-center">{totals.actual_student}</td>
                <td className="px-4 py-2.5 text-center">{totals.company_goal || '—'}</td>
                <td className="px-4 py-2.5 text-center">{totals.actual_company}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
