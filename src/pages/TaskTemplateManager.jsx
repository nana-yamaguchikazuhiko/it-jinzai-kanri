import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, deleteById, generateId } from '../api/sheets'
import { ALL_SMALL_CATS } from '../constants/categories'
import { TASK_TEMPLATES } from '../constants/taskTemplates'

const EMPTY_TEMPLATE = { small_cat: '', task_name: '', category: '', days_before: '' }

export default function TaskTemplateManager() {
  const { rows: sheetTemplates, loading, reload } = useSheets('task_templates')

  const [selectedSmallCat, setSelectedSmallCat] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addingNew, setAddingNew] = useState(false)
  const [newForm, setNewForm] = useState({ ...EMPTY_TEMPLATE })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // スプレッドシートにテンプレートがない小分類はデフォルト定数を表示
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

  // 小分類ごとにグループ化（days_before降順でソート）
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
    if (t._isDefault) {
      // デフォルトテンプレートをスプレッドシートに書き込む
      setSaving(true)
      try {
        await appendRow('task_templates', [
          generateId(), editForm.small_cat || t.small_cat,
          editForm.task_name, editForm.category, editForm.days_before,
        ])
        await reload()
        setEditingId(null)
      } catch (e) { setError(e.message) }
      finally { setSaving(false) }
    } else {
      setSaving(true)
      try {
        await updateById('task_templates', t.id, {
          id: t.id,
          small_cat: t.small_cat,
          task_name: editForm.task_name,
          category: editForm.category,
          days_before: editForm.days_before,
        })
        await reload()
        setEditingId(null)
      } catch (e) { setError(e.message) }
      finally { setSaving(false) }
    }
  }

  const handleDelete = async (t) => {
    if (t._isDefault) { alert('デフォルトテンプレートはスプレッドシートに未登録のため削除できません。先に編集して保存してください。'); return }
    if (!confirm(`「${t.task_name}」を削除しますか？`)) return
    try {
      await deleteById('task_templates', t.id)
      await reload()
    } catch (e) { setError(e.message) }
  }

  const handleAdd = async () => {
    if (!newForm.small_cat || !newForm.task_name) {
      setError('小分類とタスク名は必須です')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await appendRow('task_templates', [
        generateId(), newForm.small_cat, newForm.task_name,
        newForm.category, newForm.days_before,
      ])
      await reload()
      setAddingNew(false)
      setNewForm({ ...EMPTY_TEMPLATE })
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">タスクテンプレート管理</h1>
        <button
          className="px-4 py-2 rounded text-sm font-semibold text-gray-900 hover:opacity-90"
          style={{ background: '#06b6d4' }}
          onClick={() => { setAddingNew(true); setEditingId(null) }}
        >
          + テンプレート追加
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-5">
        イベント登録時に小分類を選択すると、ここで定義したテンプレートが自動展開されます。<br />
        「デフォルト」と表示されているものはアプリ内定数（スプレッドシート未登録）です。編集するとスプレッドシートに保存されます。
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">{error}</div>}

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 mb-5 flex gap-3 items-center">
        <label className="text-sm text-gray-500">小分類で絞り込み:</label>
        <select className="form-select max-w-xs"
          value={selectedSmallCat}
          onChange={e => setSelectedSmallCat(e.target.value)}>
          <option value="">すべて</option>
          {ALL_SMALL_CATS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        {selectedSmallCat && (
          <button className="text-sm text-gray-400 hover:text-gray-600 underline"
            onClick={() => setSelectedSmallCat('')}>クリア</button>
        )}
      </div>

      {/* 新規追加行 */}
      {addingNew && (
        <div className="bg-white rounded-lg border border-[#06b6d4] p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">新規テンプレート追加</h3>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="form-label">小分類 *</label>
              <select className="form-select" value={newForm.small_cat}
                onChange={e => setNewForm(p => ({ ...p, small_cat: e.target.value }))}>
                <option value="">選択...</option>
                {ALL_SMALL_CATS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="form-label">タスク名 *</label>
              <input type="text" className="form-input" value={newForm.task_name}
                onChange={e => setNewForm(p => ({ ...p, task_name: e.target.value }))}
                placeholder="例: Webページ作成・公開" />
            </div>
            <div>
              <label className="form-label">カテゴリ</label>
              <input type="text" className="form-input" value={newForm.category}
                onChange={e => setNewForm(p => ({ ...p, category: e.target.value }))}
                placeholder="例: HP・集客" />
            </div>
            <div>
              <label className="form-label">開催日の何日前</label>
              <input type="number" className="form-input" value={newForm.days_before}
                onChange={e => setNewForm(p => ({ ...p, days_before: e.target.value }))}
                placeholder="例: 60（後は-14）" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="text-xs px-3 py-1.5 rounded text-gray-900 font-medium disabled:opacity-50"
              style={{ background: '#06b6d4' }} onClick={handleAdd} disabled={saving}>
              {saving ? '保存中...' : '追加'}
            </button>
            <button className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => { setAddingNew(false); setError(null) }}>キャンセル</button>
          </div>
        </div>
      )}

      {/* テンプレート一覧（小分類グループ） */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">テンプレートがありません</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([smallCat, items]) => (
            <div key={smallCat} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">{smallCat}</span>
                <span className="text-xs text-gray-400">{items.length}件</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#0f1c2e' }} className="text-white text-xs">
                    <th className="text-left px-4 py-2">タスク名</th>
                    <th className="text-left px-4 py-2 w-32">カテゴリ</th>
                    <th className="text-left px-4 py-2 w-32">開催日の何日前</th>
                    <th className="text-left px-4 py-2 w-20">種別</th>
                    <th className="px-4 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t, idx) => {
                    const isEditing = editingId === (t.id || `default-${idx}`)
                    return (
                      <tr key={t.id || idx} className={`border-b border-gray-50 ${t._isDefault ? 'bg-gray-50/50' : ''}`}>
                        {isEditing ? (
                          <>
                            <td className="px-3 py-1.5">
                              <input type="text" className="form-input text-xs py-1" value={editForm.task_name}
                                onChange={e => setEditForm(p => ({ ...p, task_name: e.target.value }))} />
                            </td>
                            <td className="px-3 py-1.5">
                              <input type="text" className="form-input text-xs py-1" value={editForm.category}
                                onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} />
                            </td>
                            <td className="px-3 py-1.5">
                              <input type="number" className="form-input text-xs py-1 w-24" value={editForm.days_before}
                                onChange={e => setEditForm(p => ({ ...p, days_before: e.target.value }))} />
                            </td>
                            <td className="px-4 py-1.5"></td>
                            <td className="px-3 py-1.5">
                              <div className="flex gap-1.5">
                                <button className="text-xs px-2 py-1 rounded text-gray-900 font-medium disabled:opacity-50"
                                  style={{ background: '#06b6d4' }}
                                  onClick={() => handleSaveEdit(t)} disabled={saving}>保存</button>
                                <button className="text-xs text-gray-400 hover:text-gray-600"
                                  onClick={() => setEditingId(null)}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5">{t.task_name}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{t.category || '—'}</td>
                            <td className="px-4 py-2.5 text-xs">
                              {t.days_before >= 0 ? `${t.days_before}日前` : `${Math.abs(t.days_before)}日後`}
                            </td>
                            <td className="px-4 py-2.5">
                              {t._isDefault
                                ? <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">デフォルト</span>
                                : <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">カスタム</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex gap-2">
                                <button className="text-xs text-blue-500 hover:underline"
                                  onClick={() => {
                                    setEditingId(t.id || `default-${idx}`)
                                    setEditForm({ task_name: t.task_name, category: t.category, days_before: t.days_before })
                                    setAddingNew(false)
                                  }}>編集</button>
                                <button className="text-xs text-red-400 hover:underline"
                                  onClick={() => handleDelete(t)}>削除</button>
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
  )
}
