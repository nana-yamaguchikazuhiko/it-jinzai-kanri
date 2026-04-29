import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'

const PRIMARY = '#06b6d4'
const TEXT_PRIMARY = '#1e2d3d'
const TEXT_MUTED = '#94a3b8'
const TEXT_SECONDARY = '#64748b'
const BORDER = '#e8edf2'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (dateStr === '通年') return '通年'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

// Google Sheets が "500,000" のようにカンマ区切りで返す場合に対応
const parseAmt = (n) => Number(String(n ?? '').replace(/[,¥\s]/g, '')) || 0
const fmtAmt = (n) => parseAmt(n).toLocaleString('ja-JP')
const isIncome = (type) => type === '収入' || type === '予算' // 旧データ互換

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: TEXT_MUTED, letterSpacing: '0.07em', textTransform: 'uppercase',
}

export default function BudgetManagement() {
  const navigate = useNavigate()
  const { rows: events,      loading: le } = useSheets('events')
  const { rows: evBudgets,   loading: lb } = useSheets('event_budgets')
  const { rows: catBudgets,  loading: lc, reload: reloadCatBudgets } = useSheets('category_budgets')

  // 小分類の一覧（イベント登録順）
  const smallCats = useMemo(() => {
    const order = []; const seen = new Set()
    for (const ev of events) {
      if (ev.small_cat && !seen.has(ev.small_cat)) { seen.add(ev.small_cat); order.push(ev.small_cat) }
    }
    return order
  }, [events])

  const [activeTab, setActiveTab] = useState('')
  const currentTab = activeTab || smallCats[0] || ''

  // 小分類予算（category_budgets から現在タブの行）
  const catBudget = catBudgets.find(b => b.small_cat === currentTab)

  // 小分類予算の編集
  const [editingCatBudget, setEditingCatBudget] = useState(false)
  const [catBudgetForm, setCatBudgetForm] = useState({ amount: '', note: '' })
  const [savingCatBudget, setSavingCatBudget] = useState(false)

  const startEditCatBudget = () => {
    setCatBudgetForm({ amount: catBudget?.amount || '', note: catBudget?.note || '' })
    setEditingCatBudget(true)
  }

  const handleSaveCatBudget = async () => {
    setSavingCatBudget(true)
    const now = new Date().toISOString()
    try {
      if (catBudget) {
        await updateById('category_budgets', catBudget.id, { ...catBudget, amount: catBudgetForm.amount, note: catBudgetForm.note, updated_at: now })
      } else {
        await appendRow('category_budgets', [generateId(), currentTab, catBudgetForm.amount, catBudgetForm.note, now])
      }
      await reloadCatBudgets()
      setEditingCatBudget(false)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSavingCatBudget(false) }
  }

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

  // 現在タブのイベント別収支
  const tabEvBudgets = useMemo(() =>
    evBudgets.filter(b => tabEvents.some(e => e.id === b.event_id))
  , [evBudgets, tabEvents])

  // サマリー計算
  const catBudgetAmt  = parseAmt(catBudget?.amount)
  const evIncomeTotal = tabEvBudgets.filter(b => isIncome(b.type)).reduce((s, b) => s + parseAmt(b.amount), 0)
  const evExpenseTotal= tabEvBudgets.filter(b => b.type === '支出').reduce((s, b) => s + parseAmt(b.amount), 0)
  const balance = catBudgetAmt + evIncomeTotal - evExpenseTotal

  const loading = le || lb || lc

  return (
    <div className="p-6">
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
          <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 24, overflowX: 'auto' }}>
            {smallCats.map(cat => (
              <button key={cat} onClick={() => { setActiveTab(cat); setEditingCatBudget(false) }}
                style={{
                  padding: '10px 18px', fontSize: 12, whiteSpace: 'nowrap', fontFamily: 'inherit',
                  fontWeight: currentTab === cat ? 700 : 400,
                  color: currentTab === cat ? PRIMARY : TEXT_MUTED,
                  background: 'none', border: 'none',
                  borderBottom: currentTab === cat ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer',
                }}>
                {cat}
              </button>
            ))}
          </div>

          {/* ── 小分類予算（活動費） ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingCatBudget ? 16 : 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>小分類予算（活動費）</span>
              {!editingCatBudget && (
                <button onClick={startEditCatBudget}
                  style={{ fontSize: 12, padding: '5px 16px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {catBudget ? '編集' : '登録'}
                </button>
              )}
            </div>

            {editingCatBudget ? (
              <div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>予算額（円）</label>
                    <input
                      type="number" min="0"
                      value={catBudgetForm.amount}
                      onChange={e => setCatBudgetForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="例: 500000"
                      style={{ fontSize: 14, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 12px', width: 180, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginBottom: 4 }}>メモ</label>
                    <input
                      type="text"
                      value={catBudgetForm.note}
                      onChange={e => setCatBudgetForm(p => ({ ...p, note: e.target.value }))}
                      placeholder="例: 年間活動費として配分"
                      style={{ fontSize: 13, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 12px', width: '100%', fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleSaveCatBudget} disabled={savingCatBudget}
                      style={{ padding: '7px 20px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {savingCatBudget ? '保存中...' : '保存'}
                    </button>
                    <button onClick={() => setEditingCatBudget(false)}
                      style={{ padding: '7px 14px', background: '#f1f5f9', color: TEXT_SECONDARY, border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            ) : catBudget ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#0891b2', fontVariantNumeric: 'tabular-nums' }}>
                    ¥{fmtAmt(catBudget.amount)}
                  </span>
                  {catBudget.note && (
                    <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{catBudget.note}</span>
                  )}
                </div>
                {/* デバッグ: amountが0のとき生データを表示 */}
                {parseAmt(catBudget.amount) === 0 && (
                  <pre style={{ fontSize: 10, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginTop: 8, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                    【デバッグ】catBudget の全キー:{'\n'}{JSON.stringify(catBudget, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 8 }}>未登録</p>
            )}
          </div>

          {/* ── イベント別収支 ── */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 12 }}>イベント別収支</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tabEvents.map(ev => {
                const evItems = evBudgets.filter(b => b.event_id === ev.id)
                const evIncome  = evItems.filter(b => isIncome(b.type)).reduce((s, b) => s + parseAmt(b.amount), 0)
                const evExpense = evItems.filter(b => b.type === '支出').reduce((s, b) => s + parseAmt(b.amount), 0)
                const evBal = evIncome - evExpense

                return (
                  <div key={ev.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                    {/* イベントヘッダー */}
                    <div style={{ padding: '12px 18px', background: '#fafbfc', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{ev.name}</span>
                        <span style={{ fontSize: 11, color: TEXT_MUTED }}>{formatDate(ev.event_date)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {evItems.length > 0 && (
                          <span style={{ fontSize: 12, color: evBal >= 0 ? '#16a34a' : '#ef4444', fontWeight: 700 }}>
                            収入 ¥{fmtAmt(evIncome)}　支出 ¥{fmtAmt(evExpense)}　差額 {evBal < 0 ? '▲' : ''}¥{fmtAmt(Math.abs(evBal))}
                          </span>
                        )}
                        <button onClick={() => navigate(`/events/${ev.id}`)}
                          style={{ fontSize: 11, color: PRIMARY, background: 'none', border: `1px solid ${PRIMARY}`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                          収支登録 →
                        </button>
                      </div>
                    </div>

                    {evItems.length === 0 ? (
                      <div style={{ padding: '16px', color: TEXT_MUTED, fontSize: 12, textAlign: 'center' }}>収支未登録</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#fafbfc' }}>
                            <th style={thStyle}>項目</th>
                            <th style={thStyle}>収入 / 支出</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>金額（円）</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evItems.map(b => (
                            <tr key={b.id} style={{ borderTop: '1px solid #f8fafc' }}>
                              <td style={{ padding: '9px 16px', fontSize: 13, color: TEXT_PRIMARY }}>{b.item}</td>
                              <td style={{ padding: '9px 16px' }}>
                                <span style={{
                                  fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                                  background: isIncome(b.type) ? '#e0f7fa' : '#fef3c7',
                                  color: isIncome(b.type) ? '#0891b2' : '#d97706',
                                }}>{isIncome(b.type) ? '収入' : '支出'}</span>
                              </td>
                              <td style={{ padding: '9px 20px', fontSize: 13, color: TEXT_PRIMARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
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
          </div>

          {/* ── 収支サマリー ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: '#fafbfc', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>収支サマリー</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: `1px solid #f1f5f9` }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: TEXT_SECONDARY }}>小分類予算（活動費）</td>
                  <td style={{ padding: '14px 20px', fontSize: 15, fontWeight: 700, color: '#0891b2', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ¥{fmtAmt(catBudgetAmt)}
                  </td>
                </tr>
                <tr style={{ borderBottom: `1px solid #f1f5f9` }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: TEXT_SECONDARY }}>イベント収入合計</td>
                  <td style={{ padding: '14px 20px', fontSize: 15, fontWeight: 700, color: '#16a34a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    + ¥{fmtAmt(evIncomeTotal)}
                  </td>
                </tr>
                <tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                  <td style={{ padding: '14px 20px', fontSize: 13, color: TEXT_SECONDARY }}>支出合計</td>
                  <td style={{ padding: '14px 20px', fontSize: 15, fontWeight: 700, color: '#d97706', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    − ¥{fmtAmt(evExpenseTotal)}
                  </td>
                </tr>
                <tr style={{ background: balance >= 0 ? '#f0fdf4' : '#fff5f5' }}>
                  <td style={{ padding: '16px 20px', fontSize: 14, fontWeight: 700, color: balance >= 0 ? '#16a34a' : '#ef4444' }}>
                    残高（予算＋収入－支出）
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: 22, fontWeight: 800, color: balance >= 0 ? '#16a34a' : '#ef4444', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {balance < 0 ? '▲' : ''}¥{fmtAmt(Math.abs(balance))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
