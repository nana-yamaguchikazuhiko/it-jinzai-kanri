import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, deleteById, generateId } from '../api/sheets'
import { ALL_SMALL_CATS } from '../constants/categories'
import { TASK_TEMPLATES } from '../constants/taskTemplates'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'
import Badge from '../components/Badge'

const EMPTY_TEMPLATE = { small_cat: '', task_name: '', category: '', days_before: '' }

const th = { padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }
const td = { padding: '12px 18px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

const inputStyle = { width: '100%', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface, outline: 'none' }
const inputSmStyle = { padding: '6px 10px', fontSize: 12, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, background: T.surface, outline: 'none', width: '100%' }

export default function TaskTemplateManager() {
  const { rows: sheetTemplates, loading, reload } = useSheets('task_templates')

  const [selectedSmallCat, setSelectedSmallCat] = useState('')
  const [editingId, setEditingId]   = useState(null)
  const [editForm,  setEditForm]    = useState({})
  const [addingNew, setAddingNew]   = useState(false)
  const [newForm,   setNewForm]     = useState({ ...EMPTY_TEMPLATE })
  const [saving,    setSaving]      = useState(false)
  const [error,     setError]       = useState(null)

  const displayTemplates = useMemo(() => {
    const sheetSmallCats = [...new Set(sheetTemplates.map(t => t.small_cat))]
    const defaultForMissing = TASK_TEMPLATES
      .filter(t => !sheetSmallCats.includes(t.small_cat))
      .map((t, i) => ({ ...t, id: `default-${i}`, _isDefault: true }))
    return [...sheetTemplates, ...defaultForMissing]
  }, [sheetTemplates])

  const filtered = useMemo(() =>
    selectedSmallCat
      ? displayTemplates.filter(t => t.small_cat === selectedSmallCat)
      : displayTemplates,
  [displayTemplates, selectedSmallCat])

  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(t => {
      if (!map[t.small_cat]) map[t.small_cat] = []
      map[t.small_cat].push(t)
    })
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => Number(b.days_before) - Number(a.days_before))
    })
    return map
  }, [filtered])

  const handleSaveEdit = async (t) => {
    setSaving(true)
    try {
      if (t._isDefault) {
        await appendRow('task_templates', [
          generateId(), editForm.small_cat || t.small_cat,
          editForm.task_name, editForm.category, editForm.days_before,
        ])
      } else {
        await updateById('task_templates', t.id, {
          id: t.id, small_cat: t.small_cat,
          task_name: editForm.task_name, category: editForm.category, days_before: editForm.days_before,
        })
      }
      await reload(); setEditingId(null)
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (t) => {
    if (t._isDefault) { alert('デフォルトテンプレートはスプレッドシートに未登録のため削除できません。先に編集して保存してください。'); return }
    if (!confirm(`「${t.task_name}」を削除しますか？`)) return
    try { await deleteById('task_templates', t.id); await reload() }
    catch (e) { setError(e.message) }
  }

  const handleAdd = async () => {
    if (!newForm.small_cat || !newForm.task_name) { setError('小分類とタスク名は必須です'); return }
    setSaving(true); setError(null)
    try {
      await appendRow('task_templates', [generateId(), newForm.small_cat, newForm.task_name, newForm.category, newForm.days_before])
      await reload(); setAddingNew(false); setNewForm({ ...EMPTY_TEMPLATE })
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>タスクテンプレート</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="タスクテンプレート管理"
          subtitle="イベント登録時に小分類を選択すると、ここで定義したテンプレートが自動展開されます。「デフォルト」はアプリ内定数（スプレッドシート未登録）です。編集するとスプレッドシートに保存されます。"
          actions={
            <Btn kind="primary" icon={Icon.plus()} onClick={() => { setAddingNew(true); setEditingId(null) }}>
              テンプレート追加
            </Btn>
          }
        />

        {error && (
          <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {/* フィルターカード */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '14px 18px', marginBottom: 18, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 500, flexShrink: 0 }}>小分類で絞り込み:</span>
          <select value={selectedSmallCat} onChange={e => setSelectedSmallCat(e.target.value)}
            style={{ ...inputStyle, width: 280 }}>
            <option value="">すべて</option>
            {ALL_SMALL_CATS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          {selectedSmallCat && (
            <button onClick={() => setSelectedSmallCat('')}
              style={{ fontSize: 12, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              クリア
            </button>
          )}
        </div>

        {/* 新規追加フォーム */}
        {addingNew && (
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.teal}`, padding: '18px 20px', marginBottom: 18, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>新規テンプレート追加</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>小分類 *</label>
                <select value={newForm.small_cat} onChange={e => setNewForm(p => ({ ...p, small_cat: e.target.value }))} style={inputStyle}>
                  <option value="">選択...</option>
                  {ALL_SMALL_CATS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>タスク名 *</label>
                <input type="text" style={inputStyle} value={newForm.task_name}
                  onChange={e => setNewForm(p => ({ ...p, task_name: e.target.value }))}
                  placeholder="例: Webページ作成・公開" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>カテゴリ</label>
                <input type="text" style={inputStyle} value={newForm.category}
                  onChange={e => setNewForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="例: HP・集客" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>開催日の何日前</label>
                <input type="number" style={inputStyle} value={newForm.days_before}
                  onChange={e => setNewForm(p => ({ ...p, days_before: e.target.value }))}
                  placeholder="例: 60（後は-14）" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="primary" size="sm" onClick={handleAdd} style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? '保存中...' : '追加'}
              </Btn>
              <Btn kind="ghost" size="sm" onClick={() => { setAddingNew(false); setError(null) }}>キャンセル</Btn>
            </div>
          </div>
        )}

        {/* テンプレート一覧 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.muted, fontSize: 13 }}>読み込み中...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.muted, fontSize: 13 }}>テンプレートがありません</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(grouped).map(([smallCat, items]) => (
              <div key={smallCat} style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, boxShadow: '0 1px 0 rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                {/* セクションヘッダー */}
                <div style={{ padding: '12px 22px', background: T.surfaceAlt, borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{smallCat}</span>
                  <span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{items.length}件</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.borderSoft}` }}>
                      <th style={th}>タスク名</th>
                      <th style={{ ...th, width: 120 }}>カテゴリ</th>
                      <th style={{ ...th, width: 130 }}>開催日の何日前</th>
                      <th style={{ ...th, width: 90 }}>種別</th>
                      <th style={{ ...th, width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, idx) => {
                      const isEditing = editingId === (t.id || `default-${idx}`)
                      return (
                        <tr key={t.id || idx} style={{ borderTop: `1px solid ${T.borderSoft}`, background: t._isDefault ? T.surfaceAlt : 'transparent' }}>
                          {isEditing ? (
                            <>
                              <td style={{ ...td }}>
                                <input type="text" style={inputSmStyle} value={editForm.task_name}
                                  onChange={e => setEditForm(p => ({ ...p, task_name: e.target.value }))} />
                              </td>
                              <td style={td}>
                                <input type="text" style={inputSmStyle} value={editForm.category}
                                  onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} />
                              </td>
                              <td style={td}>
                                <input type="number" style={{ ...inputSmStyle, width: 90 }} value={editForm.days_before}
                                  onChange={e => setEditForm(p => ({ ...p, days_before: e.target.value }))} />
                              </td>
                              <td style={td}></td>
                              <td style={td}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <Btn kind="primary" size="sm" onClick={() => handleSaveEdit(t)} style={{ opacity: saving ? 0.6 : 1 }}>保存</Btn>
                                  <button onClick={() => setEditingId(null)}
                                    style={{ background: 'none', border: 'none', color: T.muted, fontSize: 16, cursor: 'pointer' }}>✕</button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...td, fontWeight: 500 }}>{t.task_name}</td>
                              <td style={{ ...td, color: T.inkSoft, fontSize: 12 }}>{t.category || '—'}</td>
                              <td style={{ ...td, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                {t.days_before >= 0
                                  ? `${t.days_before}日前`
                                  : `${Math.abs(t.days_before)}日後`}
                              </td>
                              <td style={td}>
                                {t._isDefault
                                  ? <Badge tone="neutral" size="xs">デフォルト</Badge>
                                  : <Badge tone="success" size="xs">カスタム</Badge>}
                              </td>
                              <td style={td}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                  <button
                                    onClick={() => { setEditingId(t.id || `default-${idx}`); setEditForm({ task_name: t.task_name, category: t.category, days_before: t.days_before }); setAddingNew(false) }}
                                    style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                                    編集
                                  </button>
                                  <button onClick={() => handleDelete(t)}
                                    style={{ fontSize: 12, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}>
                                    削除
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
