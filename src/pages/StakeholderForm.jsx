import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'
import { T } from '../constants/theme'
import { Icon } from '../components/Icons'
import TopBar from '../components/TopBar'
import Btn from '../components/Btn'

const EMPTY_SH = {
  name: '',
  type: '',
  institution_type: '',
  contact_name: '',
  department: '',
  position: '',
  email: '',
  phone: '',
  address: '',
  contact_status: '未連絡',
  next_action: '',
  next_action_date: '',
  memo: '',
}

const SH_TYPES = ['会員企業', '委員会企業', '教育機関', '行政', '求職者', 'その他']
const INSTITUTION_TYPES = ['大学・高専_情報系', '大学・短大_非情報系', '専門学校', '企業', '行政', 'その他']
const CONTACT_STATUSES = ['未連絡', '連絡中', '送付済', '回答済']

const inputStyle = {
  width: '100%', fontSize: 13, fontFamily: 'inherit', color: T.ink,
  border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px',
  background: T.surface, outline: 'none',
}
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }
const sectionStyle = { background: T.surface, borderRadius: 4, border: `1px solid ${T.border}`, padding: '20px 22px', marginBottom: 18, boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }

export default function StakeholderForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const { rows: stakeholders } = useSheets('stakeholders')
  const [form,   setForm  ] = useState(EMPTY_SH)
  const [saving, setSaving] = useState(false)
  const [error,  setError ] = useState(null)

  useEffect(() => {
    if (isEdit && stakeholders.length > 0) {
      const sh = stakeholders.find(s => s.id === id)
      if (sh) setForm({ ...EMPTY_SH, ...sh })
    }
  }, [isEdit, id, stakeholders])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) { setError('名称は必須です'); return }
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateById('stakeholders', id, form)
      } else {
        await appendRow('stakeholders', { id: generateId(), ...form })
      }
      navigate('/stakeholders')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: T.bg }}>
      <TopBar>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}>
          {Icon.chevL()} 戻る
        </button>
        <span>{isEdit ? 'ステークホルダー編集' : 'ステークホルダー新規登録'}</span>
      </TopBar>

      <div style={{ padding: '24px 28px', flex: 1, maxWidth: 720 }}>
        {error && (
          <div style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, color: T.dangerText, borderRadius: 8, padding: '12px 16px', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 基本情報 */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.borderSoft}` }}>基本情報</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>名称 <span style={{ color: T.danger }}>*</span></label>
                <input type="text" style={inputStyle} value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="例: 〇〇大学 キャリアセンター" />
              </div>
              <div>
                <label style={labelStyle}>種別</label>
                <select style={inputStyle} value={form.type}
                  onChange={e => handleChange('type', e.target.value)}>
                  <option value="">選択...</option>
                  {SH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>機関種別（フィールドノート分類）</label>
              <select style={inputStyle} value={form.institution_type}
                onChange={e => handleChange('institution_type', e.target.value)}>
                <option value="">選択...</option>
                {INSTITUTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>フィールドノートにステークホルダーを紐づける際の分類に使用します</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>担当者名</label>
                <input type="text" style={inputStyle} value={form.contact_name}
                  onChange={e => handleChange('contact_name', e.target.value)}
                  placeholder="例: 山田 太郎" />
              </div>
              <div>
                <label style={labelStyle}>所属（部署・学部等）</label>
                <input type="text" style={inputStyle} value={form.department}
                  onChange={e => handleChange('department', e.target.value)}
                  placeholder="例: キャリアセンター" />
              </div>
              <div>
                <label style={labelStyle}>役職</label>
                <input type="text" style={inputStyle} value={form.position}
                  onChange={e => handleChange('position', e.target.value)}
                  placeholder="例: 課長" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>メールアドレス</label>
                <input type="email" style={inputStyle} value={form.email}
                  onChange={e => handleChange('email', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>電話番号</label>
                <input type="tel" style={inputStyle} value={form.phone}
                  onChange={e => handleChange('phone', e.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>住所</label>
              <input type="text" style={inputStyle} value={form.address}
                onChange={e => handleChange('address', e.target.value)} />
            </div>
          </div>

          {/* 連絡状況・次アクション */}
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${T.borderSoft}` }}>連絡状況・次アクション</h2>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>連絡状況</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {CONTACT_STATUSES.map(s => (
                  <button key={s} type="button"
                    onClick={() => handleChange('contact_status', s)}
                    style={{
                      padding: '6px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                      background: form.contact_status === s ? T.teal : T.surfaceAlt,
                      color: form.contact_status === s ? '#fff' : T.inkSoft,
                      border: `1px solid ${form.contact_status === s ? T.teal : T.border}`,
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>次アクション</label>
              <input type="text" style={inputStyle} value={form.next_action}
                onChange={e => handleChange('next_action', e.target.value)}
                placeholder="例: 案内メールの返信を確認する" />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>次アクション期限</label>
              <input type="date" style={{ ...inputStyle, width: 180 }} value={form.next_action_date}
                onChange={e => handleChange('next_action_date', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>メモ</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.memo}
                onChange={e => handleChange('memo', e.target.value)}
                placeholder="連絡履歴・備考など" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn kind="primary" style={{ opacity: saving ? 0.6 : 1 }}>
              {saving ? '保存中...' : isEdit ? '更新する' : '登録する'}
            </Btn>
            <Btn kind="ghost" type="button" onClick={() => navigate(-1)}>キャンセル</Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
