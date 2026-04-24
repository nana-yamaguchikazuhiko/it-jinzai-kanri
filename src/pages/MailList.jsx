import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { updateById } from '../api/sheets'

const STATUSES = ['未対応', '対応中', '完了', '対応不要']

const STATUS_STYLE = {
  '未対応':  { bg: '#fee2e2', color: '#dc2626' },
  '対応中':  { bg: '#fef9c3', color: '#ca8a04' },
  '完了':    { bg: '#dcfce7', color: '#16a34a' },
  '対応不要': { bg: '#f1f5f9', color: '#64748b' },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function parseSenderName(raw) {
  if (!raw) return '—'
  const m = raw.match(/^"?(.+?)"?\s*<.+>$/)
  return m ? m[1].trim() : raw
}

function parseSenderEmail(raw) {
  if (!raw) return ''
  const m = raw.match(/<(.+)>$/)
  return m ? m[1] : raw
}

export default function MailList() {
  const { rows: mails, loading, error, reload } = useSheets('mails')

  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText]     = useState('')
  const [editingId, setEditingId]       = useState(null)
  const [editForm, setEditForm]         = useState({ status: '', memo: '' })
  const [saving, setSaving]             = useState(false)

  const sorted = useMemo(() =>
    [...mails].sort((a, b) => (b.received_at || '').localeCompare(a.received_at || '')),
  [mails])

  const filtered = useMemo(() => sorted.filter(m => {
    if (filterStatus && m.status !== filterStatus) return false
    if (searchText && !m.subject?.includes(searchText) && !m.sender_name?.includes(searchText) && !m.sender_email?.includes(searchText)) return false
    return true
  }), [sorted, filterStatus, searchText])

  const counts = useMemo(() => {
    const c = {}
    STATUSES.forEach(s => { c[s] = mails.filter(m => m.status === s).length })
    return c
  }, [mails])

  const startEdit = (mail) => {
    setEditingId(mail.id)
    setEditForm({ status: mail.status || '未対応', memo: mail.memo || '' })
  }

  const handleSave = async (mail) => {
    setSaving(true)
    try {
      await updateById('mails', mail.id, {
        ...mail,
        status: editForm.status,
        memo: editForm.memo,
        updated_at: new Date().toISOString(),
      })
      await reload()
      setEditingId(null)
    } catch (e) { alert('保存失敗: ' + e.message) }
    finally { setSaving(false) }
  }

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 text-sm">データ取得エラー: {error}</div>
    </div>
  )

  return (
    <div className="p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">問い合わせ管理</h1>
        <button onClick={reload}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer' }}>
          ↻ 更新
        </button>
      </div>

      {/* サマリーバッジ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const st = STATUS_STYLE[s]
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filterStatus === s ? st.color : st.bg,
                color: filterStatus === s ? '#fff' : st.color,
                border: `1px solid ${st.color}33`,
              }}>
              {s} {counts[s]}
            </button>
          )
        })}
      </div>

      {/* 検索 */}
      <div className="bg-white rounded-lg border border-gray-100 p-3 mb-5 flex gap-3 items-center">
        <input type="text" placeholder="差出人・件名で検索..." className="form-input max-w-sm"
          value={searchText} onChange={e => setSearchText(e.target.value)} />
        {(filterStatus || searchText) && (
          <button className="text-sm text-gray-400 hover:text-gray-600 underline"
            onClick={() => { setFilterStatus(''); setSearchText('') }}>クリア</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length}件 / {mails.length}件</span>
      </div>

      {/* テーブル */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {mails.length === 0 ? 'メールが同期されていません（GASの設定を確認してください）' : '条件に一致するメールがありません'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf2', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafbfc' }}>
                {['受信日時', '差出人', '件名', 'ステータス', 'メモ', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 20px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(mail => {
                const isEditing = editingId === mail.id
                const st = STATUS_STYLE[mail.status] || STATUS_STYLE['未対応']
                const senderName  = parseSenderName(mail.sender_name || mail.sender_email)
                const senderEmail = parseSenderEmail(mail.sender_email)

                return (
                  <tr key={mail.id} style={{ borderTop: '1px solid #f8fafc', background: isEditing ? '#f0fdf4' : 'transparent' }}>
                    <td style={{ padding: '12px 20px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatDate(mail.received_at)}
                    </td>
                    <td style={{ padding: '12px 20px', minWidth: 160 }}>
                      <div style={{ fontSize: 13, color: '#1e2d3d', fontWeight: 500 }}>{senderName}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{senderEmail}</div>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: '#1e2d3d', maxWidth: 320 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mail.subject || '（件名なし）'}</div>
                    </td>

                    {isEditing ? (
                      <>
                        <td style={{ padding: '10px 16px' }}>
                          <select className="form-select text-xs py-1 w-28"
                            value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <input type="text" className="form-input text-xs py-1"
                            placeholder="メモ..."
                            value={editForm.memo} onChange={e => setEditForm(p => ({ ...p, memo: e.target.value }))} />
                        </td>
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          <button style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: '#06b6d4', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, marginRight: 8 }}
                            onClick={() => handleSave(mail)} disabled={saving}>保存</button>
                          <button style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                            onClick={() => setEditingId(null)}>✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '12px 20px' }}>
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {mail.status || '未対応'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: 12, color: '#64748b', maxWidth: 200 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mail.memo || <span style={{ color: '#d1d5db' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 20px' }}>
                          <button style={{ fontSize: 11, color: '#06b6d4', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                            onClick={() => startEdit(mail)}>編集</button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
