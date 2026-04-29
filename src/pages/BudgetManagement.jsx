import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'

const PRIMARY = '#06b6d4'
const TEXT_PRIMARY = '#1e2d3d'
const TEXT_MUTED = '#94a3b8'
const TEXT_SECONDARY = '#64748b'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (dateStr === '通年') return '通年'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const fmtAmt = (n) => (Number(n) || 0).toLocaleString('ja-JP')

export default function BudgetManagement() {
  const navigate = useNavigate()
  const { rows: events, loading: loadingEvents } = useSheets('events')
  const { rows: budgets, loading: loadingBudgets } = useSheets('event_budgets')

  // 小分類の一覧（イベントが存在するもの）
  const smallCats = useMemo(() => {
    const order = []
    const seen = new Set()
    for (const ev of events) {
      if (ev.small_cat && !seen.has(ev.small_cat)) {
        seen.add(ev.small_cat)
        order.push(ev.small_cat)
      }
    }
    return order
  }, [events])

  const [activeTab, setActiveTab] = useState('')
  const currentTab = activeTab || smallCats[0] || ''

  // 現在タブのイベント（開催日順）
  const tabEvents = useMemo(() =>
    events
      .filter(e => e.small_cat === currentTab)
      .sort((a, b) => {
        if (a.event_date === '通年' && b.event_date !== '通年') return -1
        if (a.event_date !== '通年' && b.event_date === '通年') return 1
        return (a.event_date || '').localeCompare(b.event_date || '')
      })
  , [events, currentTab])

  // 現在タブ全体の集計
  const tabBudgets = useMemo(() =>
    budgets.filter(b => tabEvents.some(e => e.id === b.event_id))
  , [budgets, tabEvents])

  const tabTotalBudget  = tabBudgets.filter(b => b.type === '予算').reduce((s, b) => s + (Number(b.amount) || 0), 0)
  const tabTotalExpense = tabBudgets.filter(b => b.type === '支出').reduce((s, b) => s + (Number(b.amount) || 0), 0)
  const tabBalance = tabTotalBudget - tabTotalExpense

  const loading = loadingEvents || loadingBudgets

  const thStyle = {
    padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: TEXT_MUTED, letterSpacing: '0.07em', textTransform: 'uppercase',
  }

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">予算管理</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '60px 0', fontSize: 14 }}>読み込み中...</div>
      ) : smallCats.length === 0 ? (
        <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '60px 0', fontSize: 14 }}>イベントが登録されていません</div>
      ) : (
        <>
          {/* 小分類タブ */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 24, overflowX: 'auto', flexShrink: 0 }}>
            {smallCats.map(cat => (
              <button key={cat} onClick={() => setActiveTab(cat)}
                style={{
                  padding: '10px 18px', fontSize: 12, whiteSpace: 'nowrap',
                  fontWeight: currentTab === cat ? 700 : 400,
                  color: currentTab === cat ? PRIMARY : TEXT_MUTED,
                  background: 'none', border: 'none',
                  borderBottom: currentTab === cat ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {cat}
              </button>
            ))}
          </div>

          {/* タブ集計サマリー */}
          {tabBudgets.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: '予算合計', value: tabTotalBudget, color: '#0891b2', bg: '#e0f7fa' },
                { label: '支出合計', value: tabTotalExpense, color: '#d97706', bg: '#fef3c7' },
                { label: '差額', value: tabBalance, color: tabBalance >= 0 ? '#16a34a' : '#ef4444', bg: tabBalance >= 0 ? '#f0fdf4' : '#fff5f5' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 10, padding: '12px 20px', minWidth: 160 }}>
                  <div style={{ fontSize: 11, color, fontWeight: 700, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                    {value < 0 ? '▲' : ''}¥{fmtAmt(Math.abs(value))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* イベント別テーブル */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tabEvents.map(ev => {
              const evBudgets = budgets.filter(b => b.event_id === ev.id)
              const evBudgetTotal  = evBudgets.filter(b => b.type === '予算').reduce((s, b) => s + (Number(b.amount) || 0), 0)
              const evExpenseTotal = evBudgets.filter(b => b.type === '支出').reduce((s, b) => s + (Number(b.amount) || 0), 0)
              const evBalance = evBudgetTotal - evExpenseTotal

              return (
                <div key={ev.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf2', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  {/* イベントヘッダー */}
                  <div style={{ padding: '14px 20px', background: '#fafbfc', borderBottom: '1px solid #e8edf2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{ev.name}</span>
                      <span style={{ fontSize: 12, color: TEXT_MUTED }}>{formatDate(ev.event_date)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {evBudgets.length > 0 && (
                        <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                          <span style={{ color: '#0891b2', fontWeight: 600 }}>予算 ¥{fmtAmt(evBudgetTotal)}</span>
                          <span style={{ color: '#d97706', fontWeight: 600 }}>支出 ¥{fmtAmt(evExpenseTotal)}</span>
                          <span style={{ color: evBalance >= 0 ? '#16a34a' : '#ef4444', fontWeight: 700 }}>
                            差額 {evBalance < 0 ? '▲' : ''}¥{fmtAmt(Math.abs(evBalance))}
                          </span>
                        </div>
                      )}
                      <button onClick={() => navigate(`/events/${ev.id}?tab=budget`)}
                        style={{ fontSize: 11, color: PRIMARY, background: 'none', border: `1px solid ${PRIMARY}`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                        収支登録 →
                      </button>
                    </div>
                  </div>

                  {evBudgets.length === 0 ? (
                    <div style={{ padding: '20px', color: TEXT_MUTED, fontSize: 13, textAlign: 'center' }}>
                      収支未登録
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fafbfc' }}>
                          <th style={thStyle}>項目</th>
                          <th style={thStyle}>予算 / 支出</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>金額（円）</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evBudgets.map(b => (
                          <tr key={b.id} style={{ borderTop: '1px solid #f8fafc' }}>
                            <td style={{ padding: '10px 16px', fontSize: 13, color: TEXT_PRIMARY }}>{b.item}</td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{
                                fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                                background: b.type === '予算' ? '#e0f7fa' : '#fef3c7',
                                color: b.type === '予算' ? '#0891b2' : '#d97706',
                              }}>{b.type}</span>
                            </td>
                            <td style={{ padding: '10px 20px', fontSize: 13, color: TEXT_PRIMARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              ¥{fmtAmt(b.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
