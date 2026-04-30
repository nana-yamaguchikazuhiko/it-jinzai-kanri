import { useState, useMemo, useCallback, useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams, useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { updateById, appendRow, deleteById, generateId } from '../api/sheets'
import { ContactStatusBadge } from '../components/StatusBadge'

const PRIMARY = '#06b6d4'
const PRIMARY_DARK = '#0891b2'
const TEXT_PRIMARY = '#1e2d3d'
const TEXT_MUTED = '#94a3b8'
const TEXT_SECONDARY = '#64748b'
const BORDER = '#e8edf2'
const CARD_STYLE = { background: '#fff', borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }

function formatDate(dateStr) {
  if (!dateStr) return '—'
  if (dateStr === '通年') return '通年'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const TASK_STATUSES = ['未着手', '進行中', '完了']

function TaskStatusBadge({ status }) {
  const map = {
    '完了':   { bg: '#dcfce7', color: '#16a34a' },
    '進行中': { bg: '#fef9c3', color: '#ca8a04' },
    '未着手': { bg: '#f1f5f9', color: '#64748b' },
  }
  const s = map[status] || map['未着手']
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

function CatBadge({ cat }) {
  const warm = ['告知・集客', 'HP・集客']
  const isWarm = warm.includes(cat)
  return (
    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: isWarm ? '#fef3c7' : '#f1f5f9', color: isWarm ? '#d97706' : '#64748b', fontWeight: 500 }}>
      {cat || '—'}
    </span>
  )
}

function PortalLink({ label, url }) {
  if (!url) {
    return (
      <span style={{ fontSize: 12, color: TEXT_MUTED }}>
        <span style={{ fontWeight: 600, color: TEXT_SECONDARY, marginRight: 4 }}>{label}</span>未登録
      </span>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: PRIMARY, textDecoration: 'none', fontWeight: 500 }}
      onClick={e => e.stopPropagation()}>
      <span style={{ fontWeight: 600, color: TEXT_SECONDARY, marginRight: 2 }}>{label}</span>
      {url.length > 40 ? url.slice(0, 40) + '…' : url}
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7M7 1h4m0 0v4m0-4L5 7" />
      </svg>
    </a>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { rows: events } = useSheets('events')
  const { rows: tasks, reload: reloadTasks } = useSheets('tasks')
  const { rows: stakeholders } = useSheets('stakeholders')
  const { rows: eventSH, reload: reloadEventSH } = useSheets('event_stakeholders')
  const { rows: results, reload: reloadResults } = useSheets('results')
  const { rows: formSync, reload: reloadFormSync } = useSheets('form_sync')
  const { rows: eventReports, reload: reloadReports } = useSheets('event_reports')
  const { rows: surveyColumns, reload: reloadSurveyColumns } = useSheets('survey_columns')
  const { rows: surveyResponses, reload: reloadSurveyResponses } = useSheets('survey_responses')
  const { rows: eventDocs, reload: reloadDocs } = useSheets('event_documents')
  const { rows: eventBudgets, reload: reloadBudgets } = useSheets('event_budgets')

  const [activeTab, setActiveTab] = useState('tasks')
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const reportRef = useRef(null)

  // 申込・実績
  const [editingResult, setEditingResult] = useState(false)
  const [resultForm, setResultForm] = useState({ student_applied: '', company_applied: '', student_actual: '', company_actual: '' })
  const [savingResult, setSavingResult] = useState(false)

  // タスク編集・追加
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskEditForm, setTaskEditForm] = useState({})
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskForm, setNewTaskForm] = useState({ name: '', category: '', start_date: '', due_date: '', assignee: '', status: '未着手', memo: '' })
  const [savingTask, setSavingTask] = useState(false)

  // SH紐づけ
  const [addingSH, setAddingSH] = useState(false)
  const [selectedSHId, setSelectedSHId] = useState('')
  const [savingSH, setSavingSH] = useState(false)

  const event = events.find(e => e.id === id)
  const evTasks = tasks.filter(t => t.event_id === id)
  const evSHIds = eventSH.filter(r => r.event_id === id).map(r => r.stakeholder_id)
  const evStakeholders = stakeholders.filter(s => evSHIds.includes(s.id))
  const evResult = results.find(r => r.event_id === id)
  const evReport = eventReports.find(r => r.event_id === id)
  const today = new Date().toISOString().split('T')[0]
  const unlinkedSH = stakeholders.filter(s => !evSHIds.includes(s.id))

  // フォーム連携: form_syncシートから自動カウント
  const formStudentCount = formSync.filter(r => r.event_id === id && r.type === 'student').length
  const formCompanyCount = formSync.filter(r => r.event_id === id && r.type === 'company').length

  const ganttData = useMemo(() => {
    if (!event?.event_date || evTasks.length === 0) return null
    const eventDate = new Date(event.event_date)
    const start = new Date(eventDate); start.setDate(start.getDate() - 90)
    const end = new Date(eventDate); end.setDate(end.getDate() + 14)
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return { start, end, totalDays, eventDate }
  }, [event, evTasks])

  // ── タスク操作 ──────────────────────────────────────
  const handleTaskStatusChange = async (task, newStatus) => {
    try { await updateById('tasks', task.id, { ...task, status: newStatus }); reloadTasks() }
    catch (e) { alert('更新失敗: ' + e.message) }
  }

  const startEditTask = (task) => {
    setEditingTaskId(task.id)
    setTaskEditForm({ name: task.name, category: task.category, start_date: task.start_date || '', due_date: task.due_date, assignee: task.assignee, status: task.status, memo: task.memo })
  }

  const handleSaveTask = async (task) => {
    setSavingTask(true)
    try { await updateById('tasks', task.id, { ...task, ...taskEditForm }); reloadTasks(); setEditingTaskId(null) }
    catch (e) { alert('更新失敗: ' + e.message) }
    finally { setSavingTask(false) }
  }

  const handleDeleteTask = async (task) => {
    if (!confirm(`「${task.name}」を削除しますか？`)) return
    try { await deleteById('tasks', task.id); reloadTasks() }
    catch (e) { alert('削除失敗: ' + e.message) }
  }

  const handleAddTask = async () => {
    if (!newTaskForm.name) { alert('タスク名を入力してください'); return }
    setSavingTask(true)
    try {
      await appendRow('tasks', [
        generateId(), id, newTaskForm.name, newTaskForm.category,
        newTaskForm.start_date, newTaskForm.due_date,
        newTaskForm.assignee, newTaskForm.status, newTaskForm.memo,
      ])
      reloadTasks()
      setAddingTask(false)
      setNewTaskForm({ name: '', category: '', start_date: '', due_date: '', assignee: '', status: '未着手', memo: '' })
    } catch (e) { alert('追加失敗: ' + e.message) }
    finally { setSavingTask(false) }
  }

  // ── PDF生成 ──────────────────────────────────────────
  const handleGeneratePdf = async () => {
    if (!reportRef.current) return
    setGeneratingPdf(true)
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#f0f4f8' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const imgW = pageW - margin * 2
      const imgH = (canvas.height / canvas.width) * imgW
      let y = margin
      let remaining = imgH
      pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
      remaining -= (pageH - margin * 2)
      while (remaining > 0) {
        pdf.addPage()
        y = -(imgH - remaining) - margin
        pdf.addImage(imgData, 'PNG', margin, y, imgW, imgH)
        remaining -= (pageH - margin * 2)
      }
      pdf.save(`${event?.name || 'report'}_分析レポート.pdf`)
      setShowPdfModal(false)
    } catch (e) { alert('PDF生成失敗: ' + e.message) }
    finally { setGeneratingPdf(false) }
  }

  // ── イベント削除 ─────────────────────────────────────
  const handleDeleteEvent = async () => {
    if (!confirm(`「${event?.name}」を削除しますか？`)) return
    try { await deleteById('events', id); navigate('/events') }
    catch (e) { alert('削除失敗: ' + e.message) }
  }

  // ── 申込・実績 ────────────────────────────────────────
  const handleSaveResult = async () => {
    setSavingResult(true)
    try {
      const now = new Date().toISOString()
      if (evResult) {
        await updateById('results', evResult.id, { ...evResult, ...resultForm, recorded_at: now })
      } else {
        await appendRow('results', [generateId(), id, resultForm.student_applied, resultForm.company_applied, resultForm.student_actual, resultForm.company_actual, now])
      }
      reloadResults(); setEditingResult(false)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSavingResult(false) }
  }

  // ── レポート保存 ──────────────────────────────────────
  const handleSaveReport = useCallback(async (form) => {
    const now = new Date().toISOString()
    if (evReport) {
      await updateById('event_reports', evReport.id, { ...evReport, ...form, updated_at: now })
    } else {
      await appendRow('event_reports', [generateId(), id, form.overview, form.impression, form.speakers, form.ai_analysis || '', now, now])
    }
    await reloadReports()
  }, [evReport, id, reloadReports])

  const handleAddSurveyColumn = useCallback(async (col, url) => {
    const order = surveyColumns.filter(c => c.event_id === id).length + 1
    await appendRow('survey_columns', [generateId(), id, url, col.col_index, col.question_label, col.question_type, order])
    await reloadSurveyColumns()
  }, [id, surveyColumns, reloadSurveyColumns])

  const handleDeleteSurveyColumn = useCallback(async (colId) => {
    await deleteById('survey_columns', colId)
    await reloadSurveyColumns()
  }, [reloadSurveyColumns])

  // ── SH紐づけ ─────────────────────────────────────────
  const handleAddSH = async () => {
    if (!selectedSHId) return
    setSavingSH(true)
    try {
      await appendRow('event_stakeholders', [generateId(), id, selectedSHId])
      reloadEventSH(); setAddingSH(false); setSelectedSHId('')
    } catch (e) { alert('紐づけ失敗: ' + e.message) }
    finally { setSavingSH(false) }
  }

  const handleRemoveSH = async (shId) => {
    const link = eventSH.find(r => r.event_id === id && r.stakeholder_id === shId)
    if (!link) return
    if (!confirm('このステークホルダーとの紐づけを解除しますか？')) return
    try { await deleteById('event_stakeholders', link.id); reloadEventSH() }
    catch (e) { alert('解除失敗: ' + e.message) }
  }

  if (!event) {
    return <div style={{ padding: '48px', textAlign: 'center', color: TEXT_MUTED, fontSize: 14 }}>{events.length === 0 ? '読み込み中...' : 'イベントが見つかりません'}</div>
  }

  const completedTasks = evTasks.filter(t => t.status === '完了').length
  const progress = evTasks.length > 0 ? Math.round((completedTasks / evTasks.length) * 100) : 0
  const sortedTasks = [...evTasks].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

  const thStyle = { padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: TEXT_MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }
  const btnBase = { padding: '7px 18px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>

      {/* ── Top Bar ─────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 36px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/events')}
          style={{ fontSize: 13, color: PRIMARY, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
          ← イベント一覧へ戻る
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'report' && (
            <button onClick={() => setShowPdfModal(true)}
              style={{ ...btnBase, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}>
              PDF出力
            </button>
          )}
          <button onClick={() => navigate(`/events/${id}/edit`)}
            style={{ ...btnBase, background: PRIMARY, color: '#fff', border: 'none' }}>
            編集
          </button>
          <button onClick={handleDeleteEvent}
            style={{ ...btnBase, border: '1px solid #fecaca', background: '#fff5f5', color: '#ef4444' }}>
            削除
          </button>
        </div>
      </div>

      {/* PDF確認モーダル */}
      {showPdfModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '32px 36px', maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 10 }}>PDFをダウンロード</h3>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.8, marginBottom: 28 }}>
              「{event?.name}」の分析レポートをA4縦のPDFとしてダウンロードします。
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPdfModal(false)}
                style={{ padding: '8px 20px', borderRadius: 6, background: '#f1f5f9', color: TEXT_SECONDARY, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                キャンセル
              </button>
              <button onClick={handleGeneratePdf} disabled={generatingPdf}
                style={{ padding: '8px 24px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: generatingPdf ? 0.6 : 1 }}>
                {generatingPdf ? '生成中...' : 'ダウンロード'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ────────────────────────────── */}
      <div ref={reportRef} style={{ padding: '32px 36px' }}>

        {/* イベントヘッダー */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[event.big_cat, event.mid_cat, event.small_cat].filter(Boolean).map((tag, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: '#e0f7fa', color: '#0891b2', fontWeight: 500, border: '1px solid #b2ebf2' }}>
                {tag}
              </span>
            ))}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '-0.02em', lineHeight: 1.4 }}>
            {event.name}
          </h1>
        </div>

        {/* 統計カード 4列 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: '開催日', value: formatDate(event.event_date) },
            { label: '会場',   value: event.venue || '—' },
            { label: '学生目標', value: event.student_goal ? `${event.student_goal}名` : '—' },
            { label: '企業目標', value: event.company_goal ? `${event.company_goal}社` : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ ...CARD_STYLE, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ポータルサイトURL */}
        {(event.portal_company_url || event.portal_student_url) && (
          <div style={{ ...CARD_STYLE, padding: '14px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>ポータルサイト</span>
              <PortalLink label="企業向け" url={event.portal_company_url} />
              <PortalLink label="学生向け" url={event.portal_student_url} />
            </div>
          </div>
        )}

        {/* 申込実績 + タスク進捗 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 24 }}>

          {/* 申込・参加実績 */}
          <div style={{ ...CARD_STYLE, padding: '22px 26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>申込・参加実績</div>
              <button
                style={{ fontSize: 12, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => {
                  setResultForm(evResult
                    ? { student_applied: evResult.student_applied, company_applied: evResult.company_applied, student_actual: evResult.student_actual, company_actual: evResult.company_actual }
                    : resultForm)
                  setEditingResult(!editingResult)
                }}>
                {editingResult ? 'キャンセル' : '編集'}
              </button>
            </div>
            {/* フォーム自動カウント */}
            {(formStudentCount > 0 || formCompanyCount > 0) && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>フォーム自動取得</span>
                <span style={{ fontSize: 12, color: '#15803d' }}>学生申込: <strong>{formStudentCount}件</strong></span>
                <span style={{ fontSize: 12, color: '#15803d' }}>企業申込: <strong>{formCompanyCount}件</strong></span>
                <button onClick={reloadFormSync} style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', background: 'none', border: '1px solid #86efac', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
                  更新
                </button>
              </div>
            )}

            {editingResult ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {['student_applied', 'company_applied', 'student_actual', 'company_actual'].map((f, i) => (
                    <div key={f}>
                      <label className="form-label">{['学生申込（手動）', '企業申込（手動）', '学生参加実数', '企業参加実数'][i]}</label>
                      <input type="number" className="form-input" value={resultForm[f]} min="0"
                        onChange={e => setResultForm(p => ({ ...p, [f]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: 12, padding: '6px 18px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer' }}
                  onClick={handleSaveResult} disabled={savingResult}>
                  {savingResult ? '保存中...' : '保存'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  ['学生申込', formStudentCount > 0 ? formStudentCount : evResult?.student_applied, formStudentCount > 0],
                  ['企業申込', formCompanyCount > 0 ? formCompanyCount : evResult?.company_applied, formCompanyCount > 0],
                  ['学生参加実数', evResult?.student_actual, false],
                  ['企業参加実数', evResult?.company_actual, false],
                ].map(([label, value, isAuto]) => (
                  <div key={label} style={{ textAlign: 'center', padding: '12px 0', background: '#f8fafc', borderRadius: 10, position: 'relative' }}>
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: TEXT_PRIMARY }}>{value || '—'}</div>
                    {isAuto && <div style={{ fontSize: 10, color: '#16a34a', marginTop: 2 }}>自動取得</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* タスク進捗 */}
          <div style={{ ...CARD_STYLE, padding: '22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, marginBottom: 4 }}>タスク進捗</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: PRIMARY, letterSpacing: '-0.03em', marginBottom: 12 }}>{progress}%</div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${PRIMARY_DARK}, ${PRIMARY})`, borderRadius: 99, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>{completedTasks} / {evTasks.length} タスク完了</div>
          </div>
        </div>

        {/* タブ + コンテンツカード */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>

          {/* タブバー */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '0 24px' }}>
            {[
              { key: 'tasks',        label: `タスク (${evTasks.length})` },
              { key: 'gantt',        label: 'ガントチャート' },
              { key: 'stakeholders', label: `ステークホルダー (${evStakeholders.length})` },
              { key: 'budget',       label: '収支' },
              { key: 'docs',         label: 'ドキュメント' },
              { key: 'report',       label: '分析・レポート' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '14px 18px', fontSize: 13,
                  fontWeight: activeTab === tab.key ? 700 : 400,
                  color: activeTab === tab.key ? PRIMARY : TEXT_MUTED,
                  background: 'none', border: 'none',
                  borderBottom: activeTab === tab.key ? `2px solid ${PRIMARY}` : '2px solid transparent',
                  marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {tab.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto' }}>
              {activeTab === 'tasks' && (
                <button
                  style={{ padding: '8px 18px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => { setAddingTask(true); setEditingTaskId(null) }}>
                  + タスク追加
                </button>
              )}
              {activeTab === 'stakeholders' && (
                <button
                  style={{ padding: '8px 18px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => setAddingSH(true)}>
                  + ステークホルダーを紐づける
                </button>
              )}
            </div>
          </div>

          {/* ── タスクタブ ─────────────────────────── */}
          {activeTab === 'tasks' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  {['タスク名', 'カテゴリ', '開始日', '期日', 'ステータス', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 新規追加行 */}
                {addingTask && (
                  <tr style={{ borderTop: '1px solid #f8fafc', background: '#f0fdf4' }}>
                    <td style={{ padding: '10px 16px' }}><input className="form-input text-xs py-1" placeholder="タスク名 *" value={newTaskForm.name} onChange={e => setNewTaskForm(p => ({ ...p, name: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}><input className="form-input text-xs py-1" placeholder="カテゴリ" value={newTaskForm.category} onChange={e => setNewTaskForm(p => ({ ...p, category: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={newTaskForm.start_date} onChange={e => setNewTaskForm(p => ({ ...p, start_date: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={newTaskForm.due_date} onChange={e => setNewTaskForm(p => ({ ...p, due_date: e.target.value }))} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <select className="form-select text-xs py-1" value={newTaskForm.status} onChange={e => setNewTaskForm(p => ({ ...p, status: e.target.value }))}>
                        {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          onClick={handleAddTask} disabled={savingTask}>保存</button>
                        <button style={{ fontSize: 11, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => setAddingTask(false)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )}

                {evTasks.length === 0 && !addingTask ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 13, padding: '40px 0' }}>タスクがありません</td></tr>
                ) : (
                  sortedTasks.map(t => {
                    const isOverdue = t.status !== '完了' && t.due_date && t.due_date < today
                    const isEditing = editingTaskId === t.id
                    return (
                      <tr key={t.id} style={{ borderTop: '1px solid #f8fafc', background: isEditing ? '#eff6ff' : isOverdue ? '#fff5f5' : 'transparent' }}>
                        {isEditing ? (
                          <>
                            <td style={{ padding: '10px 16px' }}><input className="form-input text-xs py-1" value={taskEditForm.name} onChange={e => setTaskEditForm(p => ({ ...p, name: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}><input className="form-input text-xs py-1" value={taskEditForm.category} onChange={e => setTaskEditForm(p => ({ ...p, category: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={taskEditForm.start_date} onChange={e => setTaskEditForm(p => ({ ...p, start_date: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}><input type="date" className="form-input text-xs py-1" value={taskEditForm.due_date} onChange={e => setTaskEditForm(p => ({ ...p, due_date: e.target.value }))} /></td>
                            <td style={{ padding: '10px 12px' }}>
                              <select className="form-select text-xs py-1" value={taskEditForm.status} onChange={e => setTaskEditForm(p => ({ ...p, status: e.target.value }))}>
                                {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                  onClick={() => handleSaveTask(t)} disabled={savingTask}>保存</button>
                                <button style={{ fontSize: 11, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
                                  onClick={() => setEditingTaskId(null)}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '13px 20px', fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>{t.name}</td>
                            <td style={{ padding: '13px 20px' }}><CatBadge cat={t.category} /></td>
                            <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{formatDate(t.start_date)}</td>
                            <td style={{ padding: '13px 20px', fontSize: 12, color: isOverdue ? '#ef4444' : TEXT_SECONDARY, fontWeight: isOverdue ? 700 : 400 }}>{formatDate(t.due_date)}</td>
                            <td style={{ padding: '13px 20px' }}>
                              <select
                                value={t.status}
                                onChange={e => handleTaskStatusChange(t, e.target.value)}
                                style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 6px', background: '#fff', cursor: 'pointer', color: TEXT_PRIMARY }}>
                                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '13px 20px' }}>
                              <div style={{ display: 'flex', gap: 12 }}>
                                <button style={{ fontSize: 11, color: PRIMARY, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                                  onClick={() => { startEditTask(t); setAddingTask(false) }}>編集</button>
                                <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                  onClick={() => handleDeleteTask(t)}>削除</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}

          {/* ── ガントチャートタブ ─────────────────── */}
          {activeTab === 'gantt' && (
            <div style={{ padding: '24px 28px', overflowX: 'auto' }}>
              {!ganttData ? (
                <p style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 13, padding: '40px 0' }}>開催日またはタスクが未設定です</p>
              ) : (
                <GanttChart tasks={evTasks} ganttData={ganttData} today={today} />
              )}
            </div>
          )}

          {/* ── ステークホルダータブ ──────────────── */}
          {activeTab === 'stakeholders' && (
            <>
              {addingSH && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">ステークホルダーを選択</label>
                    <select className="form-select" value={selectedSHId} onChange={e => setSelectedSHId(e.target.value)}>
                      <option value="">選択...</option>
                      {unlinkedSH.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.contact_name ? ` (${s.contact_name})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <button style={{ padding: '8px 18px', borderRadius: 6, background: PRIMARY, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    onClick={handleAddSH} disabled={savingSH || !selectedSHId}>
                    {savingSH ? '追加中...' : '追加'}
                  </button>
                  <button style={{ fontSize: 13, color: TEXT_MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => { setAddingSH(false); setSelectedSHId('') }}>キャンセル</button>
                </div>
              )}
              {evStakeholders.length === 0 ? (
                <p style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 13, padding: '40px 0' }}>紐づくステークホルダーがありません</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafbfc' }}>
                      {['名称', '種別', '担当者', '連絡状況', '次アクション期限', ''].map((h, i) => (
                        <th key={i} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evStakeholders.map(s => (
                      <tr key={s.id} style={{ borderTop: '1px solid #f8fafc' }}>
                        <td style={{ padding: '13px 20px', fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>{s.name}</td>
                        <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{s.type}</td>
                        <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{s.contact_name || '—'}</td>
                        <td style={{ padding: '13px 20px' }}><ContactStatusBadge status={s.contact_status} /></td>
                        <td style={{ padding: '13px 20px', fontSize: 12, color: TEXT_SECONDARY }}>{formatDate(s.next_action_date)}</td>
                        <td style={{ padding: '13px 20px' }}>
                          <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => handleRemoveSH(s.id)}>紐づけ解除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {/* ── 収支タブ ──────────────────────────── */}
          {activeTab === 'budget' && (
            <BudgetTab
              eventId={id}
              budgets={eventBudgets.filter(b => b.event_id === id)}
              reload={reloadBudgets}
            />
          )}
          {/* ── ドキュメントタブ ──────────────────── */}
          {activeTab === 'docs' && (
            <DocsTab
              eventId={id}
              docs={eventDocs.filter(d => d.event_id === id)}
              reload={reloadDocs}
            />
          )}
          {/* ── 分析・レポートタブ ────────────────── */}
          {activeTab === 'report' && (
            <ReportTab
              eventId={id}
              evReport={evReport}
              formSync={formSync}
              surveyColumns={surveyColumns.filter(c => c.event_id === id)}
              surveyResponses={surveyResponses.filter(r => r.event_id === id)}
              onSaveReport={handleSaveReport}
              onAddSurveyColumn={handleAddSurveyColumn}
              onDeleteSurveyColumn={handleDeleteSurveyColumn}
              reloadSurveyResponses={reloadSurveyResponses}
              reloadSurveyColumns={reloadSurveyColumns}
              reloadFormSync={reloadFormSync}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function GanttChart({ tasks, ganttData, today }) {
  const { start, end, totalDays, eventDate } = ganttData

  const getPos = (dateStr) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    const diff = Math.ceil((d - start) / (1000 * 60 * 60 * 24))
    return Math.max(0, Math.min(100, (diff / totalDays) * 100))
  }

  const todayPos = getPos(today)
  const eventPos = getPos(eventDate.toISOString().split('T')[0])

  const monthLabels = []
  const cur = new Date(start)
  while (cur <= end) {
    monthLabels.push({ label: `${cur.getMonth() + 1}月`, pos: getPos(cur.toISOString().split('T')[0]) })
    cur.setMonth(cur.getMonth() + 1); cur.setDate(1)
  }

  const PRIMARY = '#06b6d4'
  const statusColor = { '未着手': '#d1d5db', '進行中': '#3b82f6', '完了': PRIMARY, '期限超過': '#ef4444' }

  return (
    <div>
      <div style={{ position: 'relative', height: 24, marginBottom: 4 }}>
        {monthLabels.map((m, i) => (
          <span key={i} style={{ position: 'absolute', fontSize: 11, color: '#94a3b8', transform: 'translateX(-50%)', left: `${m.pos}%` }}>{m.label}</span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        {todayPos !== null && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#f87171', zIndex: 10, left: `${todayPos}%` }} title="今日" />}
        {eventPos !== null && <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: PRIMARY, zIndex: 10, left: `${eventPos}%` }} title="開催日" />}
        {[...tasks].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(t => {
          const pos = getPos(t.due_date)
          if (pos === null) return null
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.name}>{t.name}</div>
              <div style={{ flex: 1, position: 'relative', height: 20, background: '#f1f5f9', borderRadius: 4 }}>
                <div style={{ position: 'absolute', top: 4, height: 12, width: 12, borderRadius: 3, left: `${pos}%`, background: statusColor[t.status] || '#d1d5db', transform: 'translateX(-50%)' }} title={`${t.name}: ${t.due_date}`} />
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 11, color: '#94a3b8' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, borderRadius: 2, display: 'inline-block', background: PRIMARY }} />完了</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, borderRadius: 2, display: 'inline-block', background: '#3b82f6' }} />進行中</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 8, borderRadius: 2, display: 'inline-block', background: '#d1d5db' }} />未着手</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 12, borderRadius: 1, display: 'inline-block', background: '#f87171' }} />今日</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 2, height: 12, borderRadius: 1, display: 'inline-block', background: PRIMARY }} />開催日</span>
      </div>
    </div>
  )
}

// ─── 収支タブ ─────────────────────────────────────────────────────────────────

function BudgetTab({ eventId, budgets, reload }) {
  const C = { primary: '#06b6d4', text: '#1e2d3d', muted: '#94a3b8', secondary: '#64748b', border: '#e8edf2' }
  const th = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)

  const parseAmt = (n) => Number(String(n ?? '').replace(/[,¥\s]/g, '')) || 0
  const fmtAmt = (n) => parseAmt(n).toLocaleString('ja-JP')
  const isIncome = (type) => type === '収入' || type === '予算' // 旧データ互換
  const totalIncome  = budgets.filter(b => isIncome(b.type)).reduce((s, b) => s + parseAmt(b.amount), 0)
  const totalExpense = budgets.filter(b => b.type === '支出').reduce((s, b) => s + parseAmt(b.amount), 0)
  const balance = totalIncome - totalExpense

  const startEdit = () => {
    setDraft(budgets.map(b => ({ _key: b.id, id: b.id, item: b.item, type: isIncome(b.type) ? '収入' : b.type, amount: b.amount })))
    if (budgets.length === 0) setDraft([{ _key: `new-0`, id: null, item: '', type: '支出', amount: '' }])
    setEditing(true)
  }

  const addRow = () => setDraft(p => [...p, { _key: `new-${Date.now()}`, id: null, item: '', type: '支出', amount: '' }])
  const removeRow = (key) => setDraft(p => p.filter(r => r._key !== key))
  const updateDraft = (key, field, value) => setDraft(p => p.map(r => r._key === key ? { ...r, [field]: value } : r))

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const b of budgets) await deleteById('event_budgets', b.id)
      const now = new Date().toISOString()
      for (const r of draft) {
        if (!r.item.trim()) continue
        await appendRow('event_budgets', [generateId(), eventId, r.item, r.type, r.amount || '0', now])
      }
      await reload()
      setEditing(false)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '7px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? '保存中...' : '保存'}
            </button>
            <button onClick={() => setEditing(false)}
              style={{ padding: '7px 14px', background: '#f1f5f9', color: C.secondary, border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        ) : (
          <button onClick={startEdit}
            style={{ padding: '7px 20px', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            編集
          </button>
        )}
      </div>

      {editing ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={th}>項目</th>
              <th style={th}>収入 / 支出</th>
              <th style={{ ...th, textAlign: 'right' }}>金額（円）</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {draft.map(row => (
              <tr key={row._key} style={{ borderTop: '1px solid #f8fafc' }}>
                <td style={{ padding: '7px 12px' }}>
                  <input className="form-input text-xs py-1" value={row.item} placeholder="例: 会場費"
                    onChange={e => updateDraft(row._key, 'item', e.target.value)} />
                </td>
                <td style={{ padding: '7px 12px', width: 130 }}>
                  <select className="form-select text-xs py-1" value={row.type}
                    onChange={e => updateDraft(row._key, 'type', e.target.value)}>
                    <option value="収入">収入</option>
                    <option value="支出">支出</option>
                  </select>
                </td>
                <td style={{ padding: '7px 12px', width: 160 }}>
                  <input type="number" className="form-input text-xs py-1" value={row.amount} min="0"
                    style={{ textAlign: 'right' }}
                    onChange={e => updateDraft(row._key, 'amount', e.target.value)} />
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                  <button onClick={() => removeRow(row._key)}
                    style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ padding: '8px 12px' }}>
                <button onClick={addRow}
                  style={{ width: '100%', fontSize: 12, color: C.primary, background: 'none', border: '1px dashed #06b6d4', borderRadius: 6, padding: '6px 0', cursor: 'pointer' }}>
                  ＋ 行を追加
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      ) : budgets.length === 0 ? (
        <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '40px 0' }}>
          収支が登録されていません
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              <th style={th}>項目</th>
              <th style={th}>収入 / 支出</th>
              <th style={{ ...th, textAlign: 'right' }}>金額（円）</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map(b => (
              <tr key={b.id} style={{ borderTop: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, color: C.text }}>{b.item}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                    background: isIncome(b.type) ? '#e0f7fa' : '#fef3c7',
                    color: isIncome(b.type) ? '#0891b2' : '#d97706',
                  }}>{isIncome(b.type) ? '収入' : '支出'}</span>
                </td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: C.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ¥{fmtAmt(b.amount)}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #e8edf2', background: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#0891b2' }}>収入合計</td>
              <td style={{ padding: '10px 20px', fontSize: 14, fontWeight: 800, color: '#0891b2', textAlign: 'right' }}>¥{fmtAmt(totalIncome)}</td>
            </tr>
            <tr style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#d97706' }}>支出合計</td>
              <td style={{ padding: '10px 20px', fontSize: 14, fontWeight: 800, color: '#d97706', textAlign: 'right' }}>¥{fmtAmt(totalExpense)}</td>
            </tr>
            <tr style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: balance >= 0 ? '#16a34a' : '#ef4444' }}>
                差額（収入－支出）
              </td>
              <td style={{ padding: '10px 20px', fontSize: 15, fontWeight: 800, textAlign: 'right', color: balance >= 0 ? '#16a34a' : '#ef4444' }}>
                {balance < 0 ? '▲' : ''}¥{fmtAmt(Math.abs(balance))}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── ドキュメントタブ ──────────────────────────────────────────────────────────

function DocsTab({ eventId, docs, reload }) {
  const C = { primary: '#06b6d4', text: '#1e2d3d', muted: '#94a3b8', secondary: '#64748b', border: '#e8edf2' }
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', memo: '' })
  const [saving, setSaving] = useState(false)
  const sorted = [...docs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const handleAdd = async () => {
    if (!form.name.trim() || !form.url.trim()) { alert('ドキュメント名とURLは必須です'); return }
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await appendRow('event_documents', [generateId(), eventId, form.name, form.url, form.memo, now])
      await reload()
      setForm({ name: '', url: '', memo: '' })
      setAdding(false)
    } catch (e) { alert('追加失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (doc) => {
    if (!confirm(`「${doc.name}」を削除しますか？`)) return
    try { await deleteById('event_documents', doc.id); reload() }
    catch (e) { alert('削除失敗: ' + e.message) }
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setAdding(true)}
          style={{ padding: '7px 18px', background: C.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ＋ ドキュメントを追加
        </button>
      </div>

      {adding && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="form-label">ドキュメント名 *</label>
              <input type="text" className="form-input" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="例: キックオフ議事録" />
            </div>
            <div>
              <label className="form-label">URL *</label>
              <input type="url" className="form-input" value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                placeholder="https://docs.google.com/..." />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">メモ</label>
            <input type="text" className="form-input" value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              placeholder="補足メモ..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding: '6px 20px', borderRadius: 6, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {saving ? '追加中...' : '追加'}
            </button>
            <button onClick={() => { setAdding(false); setForm({ name: '', url: '', memo: '' }) }}
              style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !adding ? (
        <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '32px 0' }}>ドキュメントが登録されていません</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fafbfc' }}>
              {['登録日', 'ドキュメント名', 'メモ', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(doc => (
              <tr key={doc.id} style={{ borderTop: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 16px', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
                  {formatDate(doc.created_at?.split('T')[0])}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: C.primary, fontWeight: 500, textDecoration: 'none' }}
                    onMouseOver={e => e.target.style.textDecoration = 'underline'}
                    onMouseOut={e => e.target.style.textDecoration = 'none'}>
                    {doc.name}
                    <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>↗</span>
                  </a>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: C.secondary }}>
                  {doc.memo || <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => handleDelete(doc)}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ─── 分析・レポートタブ ────────────────────────────────────────────────────────

function ReportTab({ eventId, evReport, formSync, surveyColumns, surveyResponses,
  onSaveReport, onAddSurveyColumn, onDeleteSurveyColumn, reloadSurveyResponses, reloadSurveyColumns, reloadFormSync }) {

  const C = { primary: '#06b6d4', text: '#1e2d3d', muted: '#94a3b8', secondary: '#64748b', border: '#e8edf2' }

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ overview: '', impression: '', speakers: '' })
  const [saving, setSaving] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newCol, setNewCol] = useState({ col_index: '', question_label: '', question_type: 'select' })
  const [newUrl, setNewUrl] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [savingCol, setSavingCol] = useState(false)
  const [editingAnswer, setEditingAnswer] = useState(null) // { id, value }
  const [savingAnswer, setSavingAnswer] = useState(false)
  const [expandedEditLabel, setExpandedEditLabel] = useState(null) // 回答編集を展開中の質問ラベル
  const [chartTypes, setChartTypes] = useState({}) // { [label]: 'bar' | 'pie' }
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [editingSchool, setEditingSchool] = useState(null) // { oldName, newName }
  const [savingSchool, setSavingSchool] = useState(false)
  const [editingAI, setEditingAI] = useState(false)
  const [aiForm, setAiForm] = useState({ ai_analysis: '' })
  const [savingAI, setSavingAI] = useState(false)

  const toggleChart = (label) =>
    setChartTypes(p => ({ ...p, [label]: p[label] === 'pie' ? 'bar' : 'pie' }))

  const handleDrop = async (toIdx) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const reordered = [...surveyResults]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setDragIdx(null); setDragOverIdx(null)
    setSavingOrder(true)
    try {
      for (let i = 0; i < reordered.length; i++) {
        const col = surveyColumns.find(c => c.question_label === reordered[i].label)
        if (col && Number(col.col_order) !== i + 1) {
          await updateById('survey_columns', col.id, { ...col, col_order: i + 1 })
        }
      }
      await reloadSurveyColumns()
    } catch (e) { alert('並び替え保存失敗: ' + e.message) }
    finally { setSavingOrder(false) }
  }

  const handleSaveSchool = async () => {
    if (!editingSchool) return
    const { oldName, newName } = editingSchool
    const trimmed = newName.trim()
    if (!trimmed) { alert('学校名を入力してください'); return }
    if (trimmed === oldName) { setEditingSchool(null); return }
    setSavingSchool(true)
    try {
      const targets = formSync.filter(r => r.event_id === eventId && r.type === 'student' && r.school_name === oldName)
      for (const row of targets) {
        await updateById('form_sync', row.id, { ...row, school_name: trimmed })
      }
      await reloadFormSync()
      setEditingSchool(null)
    } catch (e) { alert('更新失敗: ' + e.message) }
    finally { setSavingSchool(false) }
  }

  const handleSaveAI = async () => {
    setSavingAI(true)
    try {
      await onSaveReport({
        overview: evReport?.overview || '',
        impression: evReport?.impression || '',
        speakers: evReport?.speakers || '',
        ai_analysis: aiForm.ai_analysis,
      })
      setEditingAI(false)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSavingAI(false) }
  }

  const existingUrl = surveyColumns[0]?.spreadsheet_url || ''

  const schoolCounts = useMemo(() => {
    const rows = formSync.filter(r => r.event_id === eventId && r.type === 'student' && r.school_name)
    const map = {}
    rows.forEach(r => { const s = r.school_name?.trim() || '不明'; map[s] = (map[s] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [formSync, eventId])

  const companies = useMemo(() =>
    [...new Set(formSync.filter(r => r.event_id === eventId && r.type === 'company' && r.company_name).map(r => r.company_name?.trim()).filter(Boolean))]
  , [formSync, eventId])

  const surveyResults = useMemo(() => {
    const labels = surveyColumns
      .sort((a, b) => Number(a.col_order) - Number(b.col_order))
      .map(c => c.question_label)
    return labels.map(label => {
      const col = surveyColumns.find(c => c.question_label === label)
      const answerRows = surveyResponses.filter(r => r.question_label === label && r.value)
      const answers = answerRows.map(r => r.value)

      if (col?.question_type === 'select') {
        const counts = {}
        answers.forEach(a => { counts[a] = (counts[a] || 0) + 1 })
        return { label, type: 'select', counts: Object.entries(counts).sort((a, b) => b[1] - a[1]), total: answers.length }
      }
      if (col?.question_type === 'text_agg') {
        // 自由記述をグラフ集計 + 編集可能
        const counts = {}
        answerRows.forEach(r => { const v = r.value.trim(); counts[v] = (counts[v] || 0) + 1 })
        return { label, type: 'text_agg', counts: Object.entries(counts).sort((a, b) => b[1] - a[1]), answerRows, total: answerRows.length }
      }
      if (col?.question_type === 'multi') {
        // カンマ・読点・セミコロン区切りで分割して個別集計
        const counts = {}
        answers.forEach(a => {
          a.split(/[,，、;；]/).map(s => s.trim()).filter(Boolean)
            .forEach(opt => { counts[opt] = (counts[opt] || 0) + 1 })
        })
        return { label, type: 'multi', counts: Object.entries(counts).sort((a, b) => b[1] - a[1]), total: answers.length }
      }
      // text: 行オブジェクトごと保持（編集用にidが必要）
      return { label, type: 'text', answerRows, total: answerRows.length }
    })
  }, [surveyColumns, surveyResponses])

  const handleSaveAnswer = async (row) => {
    setSavingAnswer(true)
    try {
      await updateById('survey_responses', row.id, { ...row, value: editingAnswer.value })
      reloadSurveyResponses()
      setEditingAnswer(null)
    } catch (e) { alert('更新失敗: ' + e.message) }
    finally { setSavingAnswer(false) }
  }

  const startEdit = () => {
    setForm({ overview: evReport?.overview || '', impression: evReport?.impression || '', speakers: evReport?.speakers || '' })
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSaveReport(form); setEditing(false) }
    catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleAddColumn = async () => {
    if (!newCol.col_index || !newCol.question_label) { alert('列番号と質問ラベルを入力してください'); return }
    const url = existingUrl || newUrl
    if (!url) { alert('スプレッドシートURLを入力してください'); return }
    setSavingCol(true)
    try {
      await onAddSurveyColumn(newCol, url)
      setNewCol({ col_index: '', question_label: '', question_type: 'select' })
      setNewUrl('')
      setAddingColumn(false)
    } catch (e) { alert('追加失敗: ' + e.message) }
    finally { setSavingCol(false) }
  }

  const handleSync = async () => {
    if (surveyColumns.length === 0) { alert('アンケート列を設定してください'); return }
    setSyncing(true)
    try {
      const res = await fetch(`/.netlify/functions/sync-survey?event_id=${eventId}`)
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || '同期失敗') }
      const data = await res.json()
      reloadSurveyResponses()
      alert(`${data.synced}件の回答を同期しました（スプレッドシート合計: ${data.total}行）`)
    } catch (e) { alert('同期失敗: ' + e.message) }
    finally { setSyncing(false) }
  }

  const secTitle = { fontSize: 13, fontWeight: 700, color: C.text, paddingBottom: 10, marginBottom: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  const lbl = { fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* ── 基本情報 ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={secTitle}>
          <span>基本情報</span>
          <button style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            onClick={editing ? () => setEditing(false) : startEdit}>
            {editing ? 'キャンセル' : '編集'}
          </button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="form-label">概要</label>
              <textarea className="form-input" rows={4} style={{ resize: 'vertical' }}
                value={form.overview} onChange={e => setForm(p => ({ ...p, overview: e.target.value }))}
                placeholder="イベントの目的・内容・対象者などを記入..." />
            </div>
            <div>
              <label className="form-label">所見</label>
              <textarea className="form-input" rows={4} style={{ resize: 'vertical' }}
                value={form.impression} onChange={e => setForm(p => ({ ...p, impression: e.target.value }))}
                placeholder="担当者の振り返り・気づきを記入..." />
            </div>
            <div>
              <label className="form-label">登壇者</label>
              <input type="text" className="form-input"
                value={form.speakers} onChange={e => setForm(p => ({ ...p, speakers: e.target.value }))}
                placeholder="例: 山田太郎（株式会社A）、鈴木花子（株式会社B）" />
            </div>
            <button style={{ alignSelf: 'flex-start', padding: '8px 24px', borderRadius: 6, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <span style={lbl}>概要</span>
              <p style={{ fontSize: 13, color: evReport?.overview ? C.text : C.muted, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                {evReport?.overview || '未入力'}
              </p>
            </div>
            <div>
              <span style={lbl}>所見</span>
              <p style={{ fontSize: 13, color: evReport?.impression ? C.text : C.muted, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                {evReport?.impression || '未入力'}
              </p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>登壇者</span>
              <p style={{ fontSize: 13, color: evReport?.speakers ? C.text : C.muted, margin: 0 }}>
                {evReport?.speakers || '未入力'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 申込内訳 ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={secTitle}><span>申込内訳</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <span style={lbl}>学生申込 学校別内訳</span>
            {schoolCounts.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.8 }}>
                データなし
                <span style={{ display: 'block', fontSize: 11, color: '#d1d5db', marginTop: 4 }}>
                  ※ 申込フォームGASに school_name 列の取得を追加すると表示されます
                </span>
              </p>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <tbody>
                  {schoolCounts.map(([school, count]) => {
                    const isEditingThis = editingSchool?.oldName === school
                    return (
                      <tr key={school} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '5px 0' }}>
                          {isEditingThis ? (
                            <input
                              type="text"
                              className="form-input"
                              style={{ fontSize: 12, padding: '4px 8px', width: '100%' }}
                              value={editingSchool.newName}
                              onChange={e => setEditingSchool(p => ({ ...p, newName: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveSchool(); if (e.key === 'Escape') setEditingSchool(null) }}
                              autoFocus
                            />
                          ) : (
                            <span style={{ color: C.text }}>{school}</span>
                          )}
                        </td>
                        <td style={{ padding: '5px 0', textAlign: 'right', color: C.secondary, fontWeight: 600, whiteSpace: 'nowrap', paddingLeft: 8 }}>{count}名</td>
                        <td style={{ padding: '5px 0 5px 10px', whiteSpace: 'nowrap' }}>
                          {isEditingThis ? (
                            <>
                              <button style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, marginRight: 6 }}
                                onClick={handleSaveSchool} disabled={savingSchool}>
                                {savingSchool ? '...' : '保存'}
                              </button>
                              <button style={{ fontSize: 11, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
                                onClick={() => setEditingSchool(null)}>✕</button>
                            </>
                          ) : (
                            <button style={{ fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => setEditingSchool({ oldName: school, newName: school })}>編集</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <span style={lbl}>参加企業リスト</span>
            {companies.length === 0 ? (
              <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.8 }}>
                データなし
                <span style={{ display: 'block', fontSize: 11, color: '#d1d5db', marginTop: 4 }}>
                  ※ 企業申込フォームGASに company_name 列の取得を追加すると表示されます
                </span>
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: C.text }}>
                {companies.map(c => <li key={c} style={{ padding: '4px 0' }}>{c}</li>)}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── アンケート集計 ── */}
      <div>
        <div style={secTitle}>
          <span>アンケート集計</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: C.secondary, border: 'none', cursor: 'pointer' }}
              onClick={() => setAddingColumn(true)}>
              + 列を追加
            </button>
            <button style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}
              onClick={handleSync} disabled={syncing}>
              {syncing ? '同期中...' : '↻ 同期'}
            </button>
          </div>
        </div>

        {/* スプレッドシートURL表示 */}
        {existingUrl && (
          <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 11, color: C.secondary, wordBreak: 'break-all' }}>
            📊 {existingUrl}
          </div>
        )}

        {/* 列追加フォーム */}
        {addingColumn && (
          <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 20 }}>
            {!existingUrl && (
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">アンケートスプレッドシートURL</label>
                <input type="url" className="form-input" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/..." />
                <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>※ このスプレッドシートをサービスアカウントと共有してください</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px', gap: 10, alignItems: 'end' }}>
              <div>
                <label className="form-label">列番号</label>
                <input type="number" className="form-input" min="1" value={newCol.col_index}
                  onChange={e => setNewCol(p => ({ ...p, col_index: e.target.value }))} placeholder="例: 2" />
              </div>
              <div>
                <label className="form-label">質問ラベル（表示名）</label>
                <input type="text" className="form-input" value={newCol.question_label}
                  onChange={e => setNewCol(p => ({ ...p, question_label: e.target.value }))} placeholder="例: 満足度" />
              </div>
              <div>
                <label className="form-label">タイプ</label>
                <select className="form-select" value={newCol.question_type}
                  onChange={e => setNewCol(p => ({ ...p, question_type: e.target.value }))}>
                  <option value="select">選択肢（件数集計）</option>
                  <option value="multi">複数選択（個別集計）</option>
                  <option value="text_agg">自由記述（グラフ集計・編集可）</option>
                  <option value="text">自由記述（一覧・編集可）</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ padding: '6px 18px', borderRadius: 6, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                onClick={handleAddColumn} disabled={savingCol}>
                {savingCol ? '追加中...' : '追加'}
              </button>
              <button style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => { setAddingColumn(false); setNewCol({ col_index: '', question_label: '', question_type: 'select' }); setNewUrl('') }}>
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* 設定済み列タグ */}
        {surveyColumns.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {surveyColumns.sort((a, b) => Number(a.col_order) - Number(b.col_order)).map(col => (
              <span key={col.id} style={{ fontSize: 11, padding: '4px 10px', background: '#f1f5f9', borderRadius: 4, color: C.secondary, display: 'flex', alignItems: 'center', gap: 5 }}>
                {col.col_index}列: {col.question_label}
                <span style={{ fontSize: 10, color: C.muted }}>({col.question_type === 'select' ? '集計' : col.question_type === 'multi' ? '複数' : col.question_type === 'text_agg' ? '自由グラフ' : '自由'})</span>
                <button style={{ fontSize: 13, color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  onClick={() => { if (confirm(`「${col.question_label}」の設定を削除しますか？`)) onDeleteSurveyColumn(col.id) }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* ガイダンス */}
        {surveyColumns.length === 0 && !addingColumn && (
          <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '24px 0' }}>
            「+ 列を追加」からアンケートスプレッドシートのURLと列設定を登録してください
          </p>
        )}

        {/* 集計結果 */}
        {surveyResults.length > 0 && surveyResponses.length === 0 && (
          <p style={{ textAlign: 'center', color: C.muted, fontSize: 13, padding: '24px 0' }}>
            「↻ 同期」ボタンを押してアンケートデータを取得してください
          </p>
        )}
        {surveyResults.filter(q => q.total > 0).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {savingOrder && <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', gridColumn: '1 / -1' }}>並び替えを保存中...</p>}
            {surveyResults.map((q, qi) => (
              <div key={q.label}
                draggable
                onDragStart={() => setDragIdx(qi)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(qi) }}
                onDrop={() => handleDrop(qi)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                style={{
                  padding: '16px 20px',
                  background: '#fff',
                  borderRadius: 10,
                  border: `2px solid ${dragOverIdx === qi && dragIdx !== qi ? C.primary : C.border}`,
                  opacity: dragIdx === qi ? 0.4 : 1,
                  cursor: 'grab',
                  transition: 'border-color 0.15s, opacity 0.15s',
                  gridColumn: q.type === 'text' ? '1 / -1' : undefined,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, color: C.muted, cursor: 'grab', letterSpacing: '-1px', userSelect: 'none' }}>⠿⠿</span>
                  <span>{q.label}</span>
                  <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>（{q.total}件）</span>
                  {(q.type === 'select' || q.type === 'multi' || q.type === 'text_agg') && (
                    <button style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: '#fff', color: C.secondary, cursor: 'pointer' }}
                      onClick={() => toggleChart(q.label)}>
                      {chartTypes[q.label] === 'pie' ? '棒グラフ' : '円グラフ'}
                    </button>
                  )}
                </div>
                {(q.type === 'select' || q.type === 'multi' || q.type === 'text_agg') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.type === 'multi' && (
                      <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', fontStyle: 'italic' }}>
                        ※ 複数選択を選択肢ごとに集計（回答者数: {q.total}名）
                      </p>
                    )}
                    {chartTypes[q.label] === 'pie' ? (
                      <SurveyPieChart counts={q.counts} total={q.total} />
                    ) : q.counts.map(([answer, count]) => {
                      const pct = q.total > 0 ? Math.round((count / q.total) * 100) : 0
                      return (
                        <div key={answer} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 160, fontSize: 12, color: C.secondary, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={answer}>{answer}</div>
                          <div style={{ flex: 1, height: 16, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', maxWidth: 280 }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: C.primary, borderRadius: 4, transition: 'width 0.4s' }} />
                          </div>
                          <div style={{ fontSize: 12, color: C.text, fontWeight: 600, width: 70, flexShrink: 0 }}>{count}件 ({pct}%)</div>
                        </div>
                      )
                    })}
                    {/* text_agg: 回答編集トグル */}
                    {q.type === 'text_agg' && (
                      <div style={{ marginTop: 8 }}>
                        <button style={{ fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onClick={() => setExpandedEditLabel(expandedEditLabel === q.label ? null : q.label)}>
                          {expandedEditLabel === q.label ? '▲ 編集を閉じる' : '▼ 回答を編集（表記ゆれを修正）'}
                        </button>
                        {expandedEditLabel === q.label && (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {q.answerRows.map(row => (
                              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {editingAnswer?.id === row.id ? (
                                  <>
                                    <input type="text" className="form-input" style={{ flex: 1, fontSize: 12, padding: '5px 10px' }}
                                      value={editingAnswer.value}
                                      onChange={e => setEditingAnswer(p => ({ ...p, value: e.target.value }))} />
                                    <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 5, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                                      onClick={() => handleSaveAnswer(row)} disabled={savingAnswer}>
                                      {savingAnswer ? '...' : '保存'}
                                    </button>
                                    <button style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                      onClick={() => setEditingAnswer(null)}>✕</button>
                                  </>
                                ) : (
                                  <>
                                    <div style={{ flex: 1, padding: '6px 10px', background: '#f8fafc', borderRadius: 5, fontSize: 12, color: C.text }}>{row.value}</div>
                                    <button style={{ fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                                      onClick={() => setEditingAnswer({ id: row.id, value: row.value })}>編集</button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.answerRows.map((row) => (
                      <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {editingAnswer?.id === row.id ? (
                          <>
                            <input type="text" className="form-input" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                              value={editingAnswer.value}
                              onChange={e => setEditingAnswer(p => ({ ...p, value: e.target.value }))} />
                            <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 5, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                              onClick={() => handleSaveAnswer(row)} disabled={savingAnswer}>
                              {savingAnswer ? '...' : '保存'}
                            </button>
                            <button style={{ fontSize: 12, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                              onClick={() => setEditingAnswer(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <div style={{ flex: 1, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 12, color: C.text, lineHeight: 1.7 }}>{row.value}</div>
                            <button style={{ fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                              onClick={() => setEditingAnswer({ id: row.id, value: row.value })}>編集</button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI分析メモ ── */}
      <div style={{ marginTop: 32 }}>
        <div style={secTitle}>
          <span>AI分析メモ</span>
          <button style={{ fontSize: 12, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            onClick={() => {
              if (editingAI) { setEditingAI(false) } else {
                setAiForm({ ai_analysis: evReport?.ai_analysis || '' })
                setEditingAI(true)
              }
            }}>
            {editingAI ? 'キャンセル' : '編集'}
          </button>
        </div>

        {editingAI ? (
          <div>
            <p style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
              ChatGPT・Claude などで出力した分析内容をここに貼り付けてください
            </p>
            <textarea
              className="form-input"
              rows={10}
              style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.8 }}
              value={aiForm.ai_analysis}
              onChange={e => setAiForm({ ai_analysis: e.target.value })}
              placeholder="AI分析の出力結果を貼り付け..."
            />
            <button style={{ marginTop: 10, padding: '8px 24px', borderRadius: 6, background: C.primary, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              onClick={handleSaveAI} disabled={savingAI}>
              {savingAI ? '保存中...' : '保存'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e8edf2', minHeight: 80 }}>
            {evReport?.ai_analysis ? (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{evReport.ai_analysis}</ReactMarkdown>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>未入力</p>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── SVG 円グラフ ──────────────────────────────────────────────────────────────

const PIE_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#f97316', '#ec4899', '#6366f1', '#14b8a6']

function SurveyPieChart({ counts, total }) {
  const cx = 80, cy = 80, r = 72

  const toXY = (angle) => ({
    x: cx + r * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + r * Math.sin((angle - 90) * Math.PI / 180),
  })

  let angle = 0
  const slices = counts.map(([label, count], i) => {
    const deg = total > 0 ? (count / total) * 360 : 0
    const start = angle
    angle += deg
    const s = toXY(start)
    const e = toXY(angle)
    const large = deg > 180 ? 1 : 0
    const path = deg >= 359.99
      ? `M ${cx},${cy - r} A ${r},${r} 0 1 1 ${cx - 0.001},${cy - r} Z`
      : `M ${cx},${cy} L ${s.x},${s.y} A ${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`
    const pct = Math.round((count / total) * 100)
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], label, count, pct }
  })

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={160} height={160} viewBox="0 0 160 160" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1.5}>
            <title>{s.label}: {s.count}件 ({s.pct}%)</title>
          </path>
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: s.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ color: '#64748b', flex: 1, maxWidth: 200 }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: '#1e2d3d', flexShrink: 0 }}>{s.count}件</span>
            <span style={{ color: '#94a3b8', width: 44, flexShrink: 0 }}>({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
