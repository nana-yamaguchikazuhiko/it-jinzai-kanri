import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { deleteById, appendRow, updateById, generateId } from '../api/sheets'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import PageHeader from '../components/PageHeader'
import Btn from '../components/Btn'

const SH_TYPES = ['会員企業', '委員会企業', '教育機関', '行政', '求職者', 'その他']
const ALL_TABS = ['すべて', ...SH_TYPES]

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
  const { rows: shGroups, reload: reloadGroups } = useSheets('sh_groups')
  const { rows: groupMembers, reload: reloadGroupMembers } = useSheets('sh_group_members')

  const [activeTab,    setActiveTab   ] = useState('すべて')
  const [filterGroup,  setFilterGroup ] = useState(null)
  const [searchText,   setSearchText  ] = useState('')
  const [expandedId,   setExpandedId  ] = useState(null)

  const [newGroupName,    setNewGroupName   ] = useState('')
  const [editingGroupId,  setEditingGroupId ] = useState(null)
  const [editingGroupName,setEditingGroupName] = useState('')
  const [savingGroup,     setSavingGroup    ] = useState(false)

  const filtered = useMemo(() => stakeholders.filter(s => {
    if (activeTab !== 'すべて' && s.type !== activeTab) return false
    if (filterGroup) {
      const memberIds = groupMembers.filter(m => m.group_id === filterGroup).map(m => m.stakeholder_id)
      if (!memberIds.includes(s.id)) return false
    }
    if (searchText && !s.name?.includes(searchText) && !s.contact_name?.includes(searchText)) return false
    return true
  }), [stakeholders, activeTab, filterGroup, searchText, groupMembers])

  const handleDelete = async (s) => {
    if (!confirm(`「${s.name}」を削除しますか？`)) return
    try {
      await deleteById('stakeholders', s.id)
      reload()
    } catch (e) {
      alert('削除失敗: ' + e.message)
    }
  }

  const handleAddGroup = async () => {
    if (!newGroupName.trim() || savingGroup) return
    setSavingGroup(true)
    try {
      await appendRow('sh_groups', { id: generateId(), name: newGroupName.trim() })
      setNewGroupName('')
      reloadGroups()
    } catch (e) {
      alert('グループ追加失敗: ' + e.message)
    } finally {
      setSavingGroup(false)
    }
  }

  const handleDeleteGroup = async (grp) => {
    if (!confirm(`グループ「${grp.name}」を削除しますか？`)) return
    try {
      await deleteById('sh_groups', grp.id)
      if (filterGroup === grp.id) setFilterGroup(null)
      reloadGroups()
      reloadGroupMembers()
    } catch (e) {
      alert('グループ削除失敗: ' + e.message)
    }
  }

  const handleSaveGroupName = async (grp) => {
    if (!editingGroupName.trim()) return
    try {
      await updateById('sh_groups', grp.id, { name: editingGroupName.trim() })
      setEditingGroupId(null)
      reloadGroups()
    } catch (e) {
      alert('グループ更新失敗: ' + e.message)
    }
  }

  const handleToggleMember = async (stakeholderId, groupId) => {
    const existing = groupMembers.find(m => m.group_id === groupId && m.stakeholder_id === stakeholderId)
    try {
      if (existing) {
        await deleteById('sh_group_members', existing.id)
      } else {
        await appendRow('sh_group_members', { id: generateId(), group_id: groupId, stakeholder_id: stakeholderId })
      }
      reloadGroupMembers()
    } catch (e) {
      alert('グループ更新失敗: ' + e.message)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar><span>ステークホルダー</span></TopBar>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <PageHeader
          title="ステークホルダー一覧"
          subtitle="大学・企業・行政など、事業に関わるステークホルダーを管理します。"
          actions={
            <Btn kind="primary" icon={Icon.plus()} onClick={() => navigate('/stakeholders/new')}>
              新規登録
            </Btn>
          }
        />

        {/* グループ管理 */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '14px 18px', marginBottom: 14, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', marginBottom: 10 }}>グループ</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {/* すべてタグ */}
            <button
              onClick={() => setFilterGroup(null)}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600,
                background: filterGroup === null ? T.teal : T.surfaceAlt,
                color: filterGroup === null ? '#fff' : T.inkSoft,
                border: `1px solid ${filterGroup === null ? T.teal : T.border}`,
                fontFamily: 'inherit',
              }}>
              すべて
            </button>

            {shGroups.map(grp => {
              const memberCount = groupMembers.filter(m => m.group_id === grp.id).length
              const isActive = filterGroup === grp.id
              return (
                <div key={grp.id} style={{ display: 'flex', alignItems: 'center' }}>
                  {editingGroupId === grp.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        value={editingGroupName}
                        onChange={e => setEditingGroupName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveGroupName(grp)
                          if (e.key === 'Escape') setEditingGroupId(null)
                        }}
                        style={{ fontSize: 12, padding: '3px 8px', border: `1px solid ${T.teal}`, borderRadius: 4, outline: 'none', fontFamily: 'inherit', width: 130 }}
                        autoFocus
                      />
                      <button onClick={() => handleSaveGroupName(grp)}
                        style={{ fontSize: 11, padding: '3px 8px', background: T.teal, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>
                        保存
                      </button>
                      <button onClick={() => setEditingGroupId(null)}
                        style={{ fontSize: 11, color: T.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 0,
                      borderRadius: 20, overflow: 'hidden',
                      border: `1px solid ${isActive ? T.teal : T.border}`,
                      background: isActive ? T.tealBg : T.surfaceAlt,
                    }}>
                      <button
                        onClick={() => setFilterGroup(isActive ? null : grp.id)}
                        style={{
                          fontSize: 12, padding: '4px 10px', cursor: 'pointer', fontWeight: 600,
                          color: isActive ? T.teal : T.inkSoft,
                          background: 'transparent', border: 'none', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                        {grp.name}
                        <span style={{ fontSize: 10, color: T.muted }}>{memberCount}</span>
                      </button>
                      <button
                        onClick={() => { setEditingGroupId(grp.id); setEditingGroupName(grp.name) }}
                        style={{ fontSize: 10, padding: '0 5px', color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', lineHeight: '28px' }}
                        title="グループ名を編集">
                        ✎
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(grp)}
                        style={{ fontSize: 12, padding: '0 6px', color: T.muted, background: 'transparent', borderLeft: `1px solid ${T.border}`, borderTop: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', lineHeight: '28px' }}
                        title="グループを削除">
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* グループ追加 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="text" placeholder="新しいグループ名..."
              value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
              style={{ ...inputStyle, width: 190, padding: '5px 10px', fontSize: 12 }}
            />
            <button
              onClick={handleAddGroup}
              disabled={!newGroupName.trim() || savingGroup}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
                background: T.teal, color: '#fff', border: 'none', fontWeight: 600, fontFamily: 'inherit',
                opacity: !newGroupName.trim() || savingGroup ? 0.5 : 1,
              }}>
              ＋ 追加
            </button>
          </div>
        </div>

        {/* 種別タブ */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: `1px solid ${T.border}` }}>
          {ALL_TABS.map(tab => {
            const count = tab === 'すべて'
              ? stakeholders.length
              : stakeholders.filter(s => s.type === tab).length
            const isActive = activeTab === tab
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 12, padding: '8px 14px', cursor: 'pointer', fontWeight: 600,
                  background: 'transparent', border: 'none', fontFamily: 'inherit',
                  borderBottom: isActive ? `2px solid ${T.teal}` : '2px solid transparent',
                  color: isActive ? T.teal : T.inkSoft,
                  marginBottom: -1,
                }}>
                {tab}
                {count > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: T.muted }}>({count})</span>}
              </button>
            )
          })}
        </div>

        {/* 検索バー */}
        <div style={{ background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '12px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
          <input type="text" placeholder="名称・担当者名で検索..."
            value={searchText} onChange={e => setSearchText(e.target.value)}
            style={{ ...inputStyle, width: 240 }} />
          {searchText && (
            <button onClick={() => setSearchText('')}
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
                  <th style={{ ...th, width: 24, padding: '10px 0 10px 16px' }}></th>
                  <th style={th}>名称</th>
                  <th style={{ ...th, width: 100 }}>種別</th>
                  <th style={{ ...th, width: 110 }}>担当者</th>
                  <th style={{ ...th, width: 200 }}>メール</th>
                  <th style={{ ...th, width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const isExpanded = expandedId === s.id
                  const myGroupIds = groupMembers.filter(m => m.stakeholder_id === s.id).map(m => m.group_id)
                  const myGroupNames = myGroupIds.map(gid => shGroups.find(g => g.id === gid)?.name).filter(Boolean)

                  return (
                    <>
                      <tr key={s.id}
                        style={{ borderTop: `1px solid ${T.borderSoft}`, cursor: 'pointer' }}
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}>
                        <td style={{ padding: '12px 0 12px 16px', fontSize: 11, color: T.muted, userSelect: 'none' }}>
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          <span>{s.name}</span>
                          {myGroupNames.length > 0 && (
                            <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                              {myGroupNames.map(name => (
                                <span key={name} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: T.tealBg, color: T.teal, fontWeight: 600 }}>{name}</span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: 12, color: T.inkSoft }}>{s.type || '—'}</td>
                        <td style={{ ...td, fontSize: 12 }}>{s.contact_name || '—'}</td>
                        <td style={{ ...td, fontSize: 12, color: T.inkSoft }}>{s.email || '—'}</td>
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
                          <td colSpan={6} style={{ padding: '14px 24px 18px 40px', background: T.surfaceAlt, borderTop: `1px solid ${T.borderSoft}` }}>
                            {/* 詳細情報 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 24px', marginBottom: 14 }}>
                              {[
                                ['所属', s.department], ['役職', s.position], ['機関種別', s.institution_type],
                                ['電話', s.phone], ['住所', s.address],
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

                            {/* グループ割り当て */}
                            {shGroups.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.06em', marginBottom: 6 }}>グループ</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {shGroups.map(grp => {
                                    const isMember = myGroupIds.includes(grp.id)
                                    return (
                                      <button key={grp.id}
                                        onClick={e => { e.stopPropagation(); handleToggleMember(s.id, grp.id) }}
                                        style={{
                                          fontSize: 12, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                                          background: isMember ? T.teal : T.surface,
                                          color: isMember ? '#fff' : T.inkSoft,
                                          border: `1px solid ${isMember ? T.teal : T.border}`,
                                        }}>
                                        {isMember ? '✓ ' : ''}{grp.name}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
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
