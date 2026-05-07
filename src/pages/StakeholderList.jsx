import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { deleteById } from '../api/sheets'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'
import Badge, { contactStatusTone } from '../components/Badge'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const SH_TYPES = ['会員企業', '教育機関', '行政', '求職者', 'その他']
const CONTACT_STATUSES = ['未連絡', '連絡中', '送付済', '回答済']

const th = { padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }
const td = { padding: '12px 18px', fontSize: 13, color: T.ink, verticalAlign: 'middle' }

const inputStyle = {
  fontSize: 13, fontFamily: 'inherit', color: T.ink,
  border: `1px solid ${T.border}`, borderRadius: 6,
  padding: '7px 10px', background: T.surface, outline: 'none',
}

export default function StakeholderList() {
  const navigate = useNavigate()
  const { rows: stakeholders, loading, reload } = useSheets('stakeholders')

  const [filterType,   setFilterType  ] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchText,   setSearchText  ] = useState('')
  const [expandedId,   setExpandedId  ] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const filtered = useMemo(() => stakeholders.filter(s => {
    if (filterType && s.type !== filterType) return false
    if (filterStatus && s.contact_status !== filterStatus) return false
    if (searchText && !s.name?.includes(searchText) && !s.contact_name?.includes(searchText)) return false
    return true
  }), [stakeholders, filterType, filterStatus, searchText])

  const handleDelete = async (s) => {
    if (!confirm(`「${s.name}」を削除しますか？`)) return
    try {
      await deleteById('stakeholders', s.id)
      reload()
    } catch (e) {
      alert('削除失敗: ' + e.message)
    }
  }

  const hasFilter = filterType || filterStatus || searchText

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>ステークホルダー</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="ステークホルダー一覧"
          subtitle="大学・企業・行政など、事業に関わるステークホルダーの連絡状況と次アクションを管理します。"
          actions={
            <Btn kind="primary" icon={Icon.plus()} onClick={() => navigate('/stakeholders/new')}>
              新規登録
            </Btn>
          }
        />

        {/* フィルターカード */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <input type="text" placeholder="名称・担当者名で検索..."
            value={searchText} onChange={e => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 220 }} />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            <option value="">すべての種別</option>
            {SH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="">すべての連絡状況</option>
            {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasFilter && (
            <button onClick={() => { setFilterType(''); setFilterStatus(''); setSearchText('') }}
              style={{ fontSize: 12, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              クリア
            </button>
          )}
          <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{filtered.length}件 / {stakeholders.length}件</span>
        </div>

        {/* テーブル */}
        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: '60px 0', fontSize: 13 }}>
            {stakeholders.length === 0 ? 'ステークホルダーが未登録です' : '条件に一致するデータがありません'}
          </div>
        ) : (
          <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.surfaceAlt, borderBottom: `1px solid ${T.borderSoft}` }}>
                  <th style={th}>名称</th>
                  <th style={{ ...th, width: 100 }}>種別</th>
                  <th style={{ ...th, width: 110 }}>担当者</th>
                  <th style={{ ...th, width: 100 }}>連絡状況</th>
                  <th style={{ ...th, width: 200 }}>次アクション</th>
                  <th style={{ ...th, width: 100 }}>期限</th>
                  <th style={{ ...th, width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isActionOverdue = s.next_action_date && s.next_action_date < today && s.contact_status !== '回答済'
                  const isExpanded = expandedId === s.id
                  return (
                    <>
                      <tr key={s.id}
                        style={{ borderTop: `1px solid ${T.borderSoft}`, background: isActionOverdue ? T.dangerBg : 'transparent', cursor: 'pointer' }}
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                        <td style={{ ...td, fontWeight: 600 }}>{s.name}</td>
                        <td style={{ ...td, fontSize: 12, color: T.inkSoft }}>{s.type || '—'}</td>
                        <td style={{ ...td, fontSize: 12 }}>{s.contact_name || '—'}</td>
                        <td style={td}>
                          <Badge tone={contactStatusTone(s.contact_status)} size="xs">{s.contact_status || '未連絡'}</Badge>
                        </td>
                        <td style={{ ...td, fontSize: 12, color: T.inkSoft, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.next_action}>
                          {s.next_action || '—'}
                        </td>
                        <td style={{ ...td, fontSize: 12, fontVariantNumeric: 'tabular-nums', color: isActionOverdue ? T.danger : T.ink, fontWeight: isActionOverdue ? 700 : 400 }}>
                          {formatDate(s.next_action_date)}
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button onClick={e => { e.stopPropagation(); navigate(`/stakeholders/${s.id}/edit`) }}
                              style={{ fontSize: 12, color: T.teal, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                              編集
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDelete(s) }}
                              style={{ fontSize: 12, color: T.danger, background: 'none', border: 'none', cursor: 'pointer' }}>
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${s.id}-detail`}>
                          <td colSpan={7} style={{ padding: '12px 24px 16px', background: T.surfaceAlt, borderTop: `1px solid ${T.borderSoft}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 24px' }}>
                              {[
                                ['所属', s.department], ['役職', s.position], ['機関種別', s.institution_type],
                                ['メール', s.email], ['電話', s.phone], ['住所', s.address],
                              ].map(([label, val]) => (
                                <div key={label} style={{ fontSize: 12 }}>
                                  <span style={{ color: T.muted }}>{label}: </span>
                                  <span style={{ color: T.ink }}>{val || '—'}</span>
                                </div>
                              ))}
                              {s.memo && (
                                <div style={{ fontSize: 12, gridColumn: '1 / -1' }}>
                                  <span style={{ color: T.muted }}>メモ: </span>
                                  <span style={{ color: T.ink, whiteSpace: 'pre-wrap' }}>{s.memo}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
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
