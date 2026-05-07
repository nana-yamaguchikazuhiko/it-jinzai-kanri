import { useState, useMemo } from 'react'
import { useSheets } from '../hooks/useSheets'
import { updateById } from '../api/sheets'
import { T } from '../constants/theme'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'
import Badge from '../components/Badge'

const STATUSES = ['未対応', '対応中', '完了', '対応不要']

const STATUS_TONE = {
  '未対応':  'danger',
  '対応中':  'warning',
  '完了':    'success',
  '対応不要': 'neutral',
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

const th = { padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const td = { padding: '12px 18px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

const inputStyle = {
  fontSize: 13, fontFamily: 'inherit', color: T.ink,
  border: `1px solid ${T.border}`, borderRadius: 6,
  padding: '7px 10px', background: T.surface, outline: 'none',
}

export default function MailList() {
  const { rows: mails, loading, error, reload } = useSheets('mails')

  const [filterStatus, setFilterStatus] = useState('')
  const [searchText,   setSearchText  ] = useState('')
  const [editingId,    setEditingId   ] = useState(null)
  const [editForm,     setEditForm    ] = useState({ status: '', memo: '' })
  const [saving,       setSaving      ] = useState(false)

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>問い合わせ管理</span></TopBar>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
          データ取得エラー: {error}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>問い合わせ管理</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="問い合わせ管理"
          subtitle="GASで同期されたメールの対応状況を管理します。"
          actions={
            <button onClick={reload}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.inkSoft, cursor: 'pointer', fontFamily: 'inherit' }}>
              ↻ 更新
            </button>
          }
        />

        {/* ステータスバッジ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              style={{
                padding: '6px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: filterStatus === s ? T.teal : T.surfaceAlt,
                color: filterStatus === s ? '#fff' : T.inkSoft,
                border: `1px solid ${filterStatus === s ? T.teal : T.border}`,
              }}>
              {s} {counts[s]}
            </button>
          ))}
        </div>

        {/* 検索 */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '12px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <input type="text" placeholder="差出人・件名で検索..." value={searchText}
            onChange={e => setSearchText(e.target.value)} style={{ ...inputStyle, width: 280 }} />
          {(filterStatus || searchText) && (
            <button onClick={() => { setFilterStatus(''); setSearchText('') }}
              style={{ fontSize: 12, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              クリア
            </button>
          )}
          <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{filtered.length}件 / {mails.length}件</span>
        </div>

        {/* テーブル */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>
            {mails.length === 0 ? 'メールが同期されていません（GASの設定を確認してください）' : '条件に一致するメールがありません'}
          </div>
        ) : (
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.borderSoft}` }}>
                  <th style={{ ...th, width: 140 }}>受信日時</th>
                  <th style={{ ...th, width: 180 }}>差出人</th>
                  <th style={th}>件名</th>
                  <th style={{ ...th, width: 100 }}>ステータス</th>
                  <th style={{ ...th, width: 180 }}>メモ</th>
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(mail => {
                  const isEditing = editingId === mail.id
                  const senderName  = parseSenderName(mail.sender_name || mail.sender_email)
                  const senderEmail = parseSenderEmail(mail.sender_email)

                  return (
                    <tr key={mail.id} style={{ borderTop: `1px solid ${T.borderSoft}`, background: isEditing ? T.tealBg : 'transparent' }}>
                      <td style={{ ...td, fontSize: 12, color: T.inkSoft, whiteSpace: 'nowrap' }}>
                        {formatDate(mail.received_at)}
                      </td>
                      <td style={{ ...td, minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{senderName}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{senderEmail}</div>
                      </td>
                      <td style={{ ...td, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mail.subject || '（件名なし）'}
                      </td>

                      {isEditing ? (
                        <>
                          <td style={{ padding: '10px 16px' }}>
                            <select value={editForm.status}
                              onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                              style={{ fontSize: 12, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 8px', background: T.surface, outline: 'none', width: 90 }}>
                              {STATUSES.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <input type="text" placeholder="メモ..." value={editForm.memo}
                              onChange={e => setEditForm(p => ({ ...p, memo: e.target.value }))}
                              style={{ fontSize: 12, fontFamily: 'inherit', color: T.ink, border: `1px solid ${T.border}`, borderRadius: 6, padding: '4px 8px', background: T.surface, outline: 'none', width: '100%' }} />
                          </td>
                          <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <Btn kind="primary" size="sm" onClick={() => handleSave(mail)} style={{ opacity: saving ? 0.6 : 1 }}>保存</Btn>
                              <button onClick={() => setEditingId(null)}
                                style={{ fontSize: 16, color: T.muted, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={td}>
                            <Badge tone={STATUS_TONE[mail.status] || 'neutral'} size="xs">{mail.status || '未対応'}</Badge>
                          </td>
                          <td style={{ ...td, fontSize: 12, color: T.inkSoft, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mail.memo || <span style={{ color: T.faint }}>—</span>}
                          </td>
                          <td style={td}>
                            <button onClick={() => startEdit(mail)}
                              style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                              編集
                            </button>
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
    </div>
  )
}
