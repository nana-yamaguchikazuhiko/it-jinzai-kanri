import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'
import { ALL_SMALL_CATS } from '../constants/categories'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'
import CategoryChip, { getEventCatKey, CategoryLegend } from '../components/CategoryChip'

const CURRENT_YEAR = new Date().getFullYear()
const FISCAL_YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

const th = { padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }
const td = { padding: '12px 18px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

export default function GoalManagement() {
  const { rows: goals, reload: reloadGoals, loading: goalsLoading } = useSheets('goals')
  const { rows: events } = useSheets('events')
  const { rows: results } = useSheets('results')

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [editingId,    setEditingId]    = useState(null)
  const [editForm,     setEditForm]     = useState({})
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState(null)

  const yearGoals = useMemo(() =>
    goals.filter(g => String(g.fiscal_year) === String(selectedYear)),
  [goals, selectedYear])

  const actuals = useMemo(() => {
    const map = {}
    events.forEach(ev => {
      const res = results.find(r => r.event_id === ev.id)
      if (!res || (!res.student_actual && !res.company_actual)) return
      if (!map[ev.small_cat]) map[ev.small_cat] = { hold_count: 0, student: 0, company: 0 }
      map[ev.small_cat].hold_count += 1
      map[ev.small_cat].student   += Number(res.student_actual || 0)
      map[ev.small_cat].company   += Number(res.company_actual || 0)
    })
    return map
  }, [events, results])

  const rows = useMemo(() => {
    return ALL_SMALL_CATS.map(s => {
      const goal   = yearGoals.find(g => g.small_cat === s.name)
      const actual = actuals[s.name] || { hold_count: 0, student: 0, company: 0 }
      return {
        small_cat:       s.name,
        bigName:         s.bigName,
        midName:         s.midName,
        goal_id:         goal?.id || null,
        hold_count_goal: goal?.hold_count_goal || '',
        student_goal:    goal?.student_goal    || '',
        company_goal:    goal?.company_goal    || '',
        actual_hold:     actual.hold_count,
        actual_student:  actual.student,
        actual_company:  actual.company,
      }
    })
  }, [yearGoals, actuals])

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    hold_count_goal: acc.hold_count_goal + (Number(r.hold_count_goal) || 0),
    student_goal:    acc.student_goal    + (Number(r.student_goal)    || 0),
    company_goal:    acc.company_goal    + (Number(r.company_goal)    || 0),
    actual_hold:     acc.actual_hold     + r.actual_hold,
    actual_student:  acc.actual_student  + r.actual_student,
    actual_company:  acc.actual_company  + r.actual_company,
  }), { hold_count_goal: 0, student_goal: 0, company_goal: 0, actual_hold: 0, actual_student: 0, actual_company: 0 }),
  [rows])

  const startEdit = (row) => {
    setEditingId(row.small_cat)
    setEditForm({ hold_count_goal: row.hold_count_goal, student_goal: row.student_goal, company_goal: row.company_goal })
  }

  const handleSave = async (row) => {
    setSaving(true); setError(null)
    try {
      if (row.goal_id) {
        await updateById('goals', row.goal_id, { id: row.goal_id, fiscal_year: selectedYear, small_cat: row.small_cat, ...editForm })
      } else {
        await appendRow('goals', { id: generateId(), fiscal_year: String(selectedYear), small_cat: row.small_cat, hold_count_goal: editForm.hold_count_goal || '', student_goal: editForm.student_goal || '', company_goal: editForm.company_goal || '' })
      }
      await reloadGoals(); setEditingId(null)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const achieveRate = (actual, goal) => {
    if (!goal || Number(goal) === 0) return null
    return Math.round((actual / Number(goal)) * 100)
  }

  const RateBar = ({ actual, goal }) => {
    const pct = achieveRate(actual, goal)
    if (pct === null) return <span style={{ color: T.muted, fontSize: 12 }}>—</span>
    const barColor = pct >= 50 ? T.success : T.warning
    const textColor = pct >= 50 ? T.successText : T.warningText
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 60, height: 4, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: textColor, fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>{pct}%</span>
      </div>
    )
  }

  const inputStyle = { padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, width: 72, background: T.surface, outline: 'none' }
  const numCell = (val, hasGoal) => (
    <span style={{ fontVariantNumeric: 'tabular-nums', color: hasGoal ? T.ink : T.muted }}>
      {val != null ? (val === '' ? '—' : val) : '—'}
    </span>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>目標・実績管理</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="目標・実績管理"
          subtitle={`${selectedYear}年度の活動実績と目標達成率`}
          actions={
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{ padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface, outline: 'none', width: 140 }}
            >
              {FISCAL_YEARS.map(y => <option key={y} value={y}>{y}年度</option>)}
            </select>
          }
        />

        {error && (
          <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* サマリーKPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
          {[
            { label: '開催回数',          goal: totals.hold_count_goal, actual: totals.actual_hold },
            { label: '学生参加数（延べ）', goal: totals.student_goal,    actual: totals.actual_student },
            { label: '企業参加数（延べ）', goal: totals.company_goal,    actual: totals.actual_company },
          ].map(({ label, goal, actual }) => {
            const pct = achieveRate(actual, goal)
            const barColor = pct != null && pct >= 50 ? T.success : T.warning
            return (
              <div key={label} style={{ background: T.surface, borderRadius: 4, padding: '18px 20px', border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600, marginBottom: 10 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: T.ink, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{actual}</span>
                  <span style={{ fontSize: 14, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>/ {goal || '—'}</span>
                  {pct != null && (
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  )}
                </div>
                <div style={{ height: 6, background: T.borderSoft, borderRadius: 99, overflow: 'hidden' }}>
                  {pct != null && <div style={{ width: `${Math.max(Math.min(pct, 100), 2)}%`, height: '100%', background: barColor, borderRadius: 99 }} />}
                </div>
              </div>
            )
          })}
        </div>

        {/* テーブル */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderSoft}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>小分類別 達成状況</h3>
            <CategoryLegend />
          </div>

          {goalsLoading ? (
            <p style={{ textAlign: 'center', padding: '32px 0', color: T.muted, fontSize: 13 }}>読み込み中...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.surfaceAlt }}>
                  <th style={{ ...th, paddingLeft: 22 }}>小分類</th>
                  <th style={{ ...th, textAlign: 'center', borderLeft: `1px solid ${T.borderSoft}` }} colSpan={2}>開催回数</th>
                  <th style={{ ...th, textAlign: 'center', borderLeft: `1px solid ${T.borderSoft}` }} colSpan={3}>学生参加</th>
                  <th style={{ ...th, textAlign: 'center', borderLeft: `1px solid ${T.borderSoft}` }} colSpan={3}>企業参加</th>
                  <th style={{ ...th, textAlign: 'right', paddingRight: 22 }}></th>
                </tr>
                <tr style={{ background: T.surfaceAlt, borderTop: `1px solid ${T.borderSoft}` }}>
                  <th style={{ ...th, paddingLeft: 22 }}></th>
                  <th style={{ ...th, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}` }}>目標</th>
                  <th style={{ ...th, textAlign: 'right' }}>実績</th>
                  <th style={{ ...th, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}` }}>目標</th>
                  <th style={{ ...th, textAlign: 'right' }}>実績</th>
                  <th style={{ ...th, textAlign: 'right' }}>達成率</th>
                  <th style={{ ...th, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}` }}>目標</th>
                  <th style={{ ...th, textAlign: 'right' }}>実績</th>
                  <th style={{ ...th, textAlign: 'right' }}>達成率</th>
                  <th style={{ ...th, textAlign: 'right', paddingRight: 22 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isEditing = editingId === row.small_cat
                  const catKey    = getEventCatKey(row.small_cat)
                  const noTarget  = !row.hold_count_goal
                  return (
                    <tr key={row.small_cat} style={{ borderTop: `1px solid ${T.borderSoft}` }}>
                      <td style={{ ...td, paddingLeft: 22 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CategoryChip cat={catKey} size="sm" />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{row.small_cat}</div>
                            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{row.bigName}</div>
                          </div>
                        </div>
                      </td>

                      {isEditing ? (
                        <>
                          <td style={{ ...td, borderLeft: `1px solid ${T.borderSoft}`, textAlign: 'right' }}>
                            <input type="number" style={inputStyle} value={editForm.hold_count_goal}
                              onChange={e => setEditForm(p => ({ ...p, hold_count_goal: e.target.value }))} min="0" />
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.actual_hold}</td>
                          <td style={{ ...td, borderLeft: `1px solid ${T.borderSoft}`, textAlign: 'right' }}>
                            <input type="number" style={inputStyle} value={editForm.student_goal}
                              onChange={e => setEditForm(p => ({ ...p, student_goal: e.target.value }))} min="0" />
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.actual_student}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <RateBar actual={row.actual_student} goal={editForm.student_goal} />
                          </td>
                          <td style={{ ...td, borderLeft: `1px solid ${T.borderSoft}`, textAlign: 'right' }}>
                            <input type="number" style={inputStyle} value={editForm.company_goal}
                              onChange={e => setEditForm(p => ({ ...p, company_goal: e.target.value }))} min="0" />
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.actual_company}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <RateBar actual={row.actual_company} goal={editForm.company_goal} />
                          </td>
                          <td style={{ ...td, textAlign: 'right', paddingRight: 22 }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <Btn kind="primary" size="sm" onClick={() => handleSave(row)} style={{ opacity: saving ? 0.6 : 1 }}>保存</Btn>
                              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 16, cursor: 'pointer' }}>✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...td, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}`, fontVariantNumeric: 'tabular-nums', color: noTarget ? T.muted : T.ink }}>{row.hold_count_goal || '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: row.actual_hold > 0 ? 600 : 400, color: row.actual_hold > 0 ? T.ink : T.muted }}>{row.actual_hold}</td>
                          <td style={{ ...td, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}`, fontVariantNumeric: 'tabular-nums', color: !row.student_goal ? T.muted : T.ink }}>{row.student_goal || '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: row.actual_student > 0 ? 600 : 400, color: row.actual_student > 0 ? T.ink : T.muted }}>{row.actual_student}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <RateBar actual={row.actual_student} goal={row.student_goal} />
                          </td>
                          <td style={{ ...td, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}`, fontVariantNumeric: 'tabular-nums', color: !row.company_goal ? T.muted : T.ink }}>{row.company_goal || '—'}</td>
                          <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: row.actual_company > 0 ? 600 : 400, color: row.actual_company > 0 ? T.ink : T.muted }}>{row.actual_company}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <RateBar actual={row.actual_company} goal={row.company_goal} />
                          </td>
                          <td style={{ ...td, textAlign: 'right', paddingRight: 22 }}>
                            <button onClick={() => startEdit(row)} style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: T.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              {Icon.edit(14)}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}

                {/* 合計行 */}
                <tr style={{ borderTop: `2px solid ${T.border}`, background: T.surfaceAlt }}>
                  <td style={{ ...td, paddingLeft: 22, fontWeight: 700 }}>合計</td>
                  <td style={{ ...td, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}`, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totals.hold_count_goal || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totals.actual_hold}</td>
                  <td style={{ ...td, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}`, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totals.student_goal || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totals.actual_student}</td>
                  <td style={{ ...td, textAlign: 'right' }}><RateBar actual={totals.actual_student} goal={totals.student_goal} /></td>
                  <td style={{ ...td, textAlign: 'right', borderLeft: `1px solid ${T.borderSoft}`, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totals.company_goal || '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{totals.actual_company}</td>
                  <td style={{ ...td, textAlign: 'right' }}><RateBar actual={totals.actual_company} goal={totals.company_goal} /></td>
                  <td style={{ paddingRight: 22 }}></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
