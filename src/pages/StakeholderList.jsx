import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { deleteById } from '../api/sheets'
import { ContactStatusBadge } from '../components/StatusBadge'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const SH_TYPES = ['会員企業', '教育機関', '行政', '求職者', 'その他']
const CONTACT_STATUSES = ['未連絡', '連絡中', '送付済', '回答済']

export default function StakeholderList() {
  const navigate = useNavigate()
  const { rows: stakeholders, loading, reload } = useSheets('stakeholders')

  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText] = useState('')
  const [expandedId, setExpandedId] = useState(null)

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">ステークホルダー一覧</h1>
        <button
          className="px-4 py-2 rounded text-sm font-semibold text-gray-900 hover:opacity-90 transition-opacity flex items-center gap-1.5"
          style={{ background: '#29e6d3' }}
          onClick={() => navigate('/stakeholders/new')}
        >
          <span className="text-lg leading-none">+</span>新規登録
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-5 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="名称・担当者名で検索..."
          className="form-input max-w-xs"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        <select
          className="form-select w-36"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">すべての種別</option>
          {SH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          className="form-select w-36"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">すべての連絡状況</option>
          {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(filterType || filterStatus || searchText) && (
          <button
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            onClick={() => { setFilterType(''); setFilterStatus(''); setSearchText('') }}
          >
            クリア
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">{filtered.length}件 / {stakeholders.length}件</p>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">
              {stakeholders.length === 0 ? 'ステークホルダーが未登録です' : '条件に一致するデータがありません'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#262526' }} className="text-white text-xs">
                  <th className="text-left px-4 py-2.5">名称</th>
                  <th className="text-left px-4 py-2.5">種別</th>
                  <th className="text-left px-4 py-2.5">担当者</th>
                  <th className="text-left px-4 py-2.5">連絡状況</th>
                  <th className="text-left px-4 py-2.5">次アクション</th>
                  <th className="text-left px-4 py-2.5">期限</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isActionOverdue = s.next_action_date && s.next_action_date < today && s.contact_status !== '回答済'
                  const isExpanded = expandedId === s.id
                  return (
                    <>
                      <tr
                        key={s.id}
                        className={`border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer ${isActionOverdue ? 'bg-red-50' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      >
                        <td className="px-4 py-2.5 font-medium">{s.name}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{s.type || '—'}</td>
                        <td className="px-4 py-2.5 text-xs">{s.contact_name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <ContactStatusBadge status={s.contact_status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[160px] truncate" title={s.next_action}>
                          {s.next_action || '—'}
                        </td>
                        <td className={`px-4 py-2.5 text-xs font-mono ${isActionOverdue ? 'text-red-600 font-bold' : ''}`}>
                          {formatDate(s.next_action_date)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              className="text-xs text-blue-500 hover:underline"
                              onClick={e => { e.stopPropagation(); navigate(`/stakeholders/${s.id}/edit`) }}
                            >
                              編集
                            </button>
                            <button
                              className="text-xs text-red-400 hover:underline"
                              onClick={e => { e.stopPropagation(); handleDelete(s) }}
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${s.id}-detail`} className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="grid grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-gray-400">メール:</span>{' '}
                                <span>{s.email || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">電話:</span>{' '}
                                <span>{s.phone || '—'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">住所:</span>{' '}
                                <span>{s.address || '—'}</span>
                              </div>
                              {s.memo && (
                                <div className="col-span-3">
                                  <span className="text-gray-400">メモ:</span>{' '}
                                  <span className="whitespace-pre-wrap">{s.memo}</span>
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
          )}
        </div>
      )}
    </div>
  )
}
