import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSheets } from '../hooks/useSheets'
import { appendRow, updateById, generateId } from '../api/sheets'

const EMPTY_SH = {
  name: '',
  type: '',
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

const SH_TYPES = ['会員企業', '教育機関', '行政', '求職者', 'その他']
const CONTACT_STATUSES = ['未連絡', '連絡中', '送付済', '回答済']

export default function StakeholderForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const { rows: stakeholders } = useSheets('stakeholders')
  const [form, setForm] = useState(EMPTY_SH)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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
    if (!form.name) {
      setError('名称は必須です')
      return
    }
    setSaving(true)
    setError(null)

    try {
      if (isEdit) {
        await updateById('stakeholders', id, form)
      } else {
        const now = new Date().toISOString()
        await appendRow('stakeholders', [
          generateId(),
          form.name,
          form.type,
          form.contact_name,
          form.email,
          form.phone,
          form.address,
          form.contact_status,
          form.next_action,
          form.next_action_date,
          form.memo,
          form.department,
          form.position,
        ])
      }
      navigate('/stakeholders')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => navigate(-1)}>
          ← 戻る
        </button>
        <h1 className="text-xl font-bold text-gray-800">
          {isEdit ? 'ステークホルダー編集' : 'ステークホルダー新規登録'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">基本情報</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">名称 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={e => handleChange('name', e.target.value)}
                  placeholder="例: 〇〇大学 キャリアセンター"
                />
              </div>
              <div>
                <label className="form-label">種別</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={e => handleChange('type', e.target.value)}
                >
                  <option value="">選択...</option>
                  {SH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="form-label">担当者名</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.contact_name}
                  onChange={e => handleChange('contact_name', e.target.value)}
                  placeholder="例: 山田 太郎"
                />
              </div>
              <div>
                <label className="form-label">所属（部署・学部等）</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.department}
                  onChange={e => handleChange('department', e.target.value)}
                  placeholder="例: キャリアセンター"
                />
              </div>
              <div>
                <label className="form-label">役職</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.position}
                  onChange={e => handleChange('position', e.target.value)}
                  placeholder="例: 課長"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">メールアドレス</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={e => handleChange('email', e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">電話番号</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="form-label">住所</label>
              <input
                type="text"
                className="form-input"
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 border-b pb-2">連絡状況・次アクション</h2>
          <div className="space-y-4">
            <div>
              <label className="form-label">連絡状況</label>
              <div className="flex gap-2">
                {CONTACT_STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`px-3 py-1.5 text-xs rounded border font-medium transition-colors ${
                      form.contact_status === s
                        ? 'text-gray-900 border-transparent'
                        : 'text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                    style={form.contact_status === s ? { background: '#29e6d3' } : {}}
                    onClick={() => handleChange('contact_status', s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">次アクション</label>
              <input
                type="text"
                className="form-input"
                value={form.next_action}
                onChange={e => handleChange('next_action', e.target.value)}
                placeholder="例: 案内メールの返信を確認する"
              />
            </div>
            <div>
              <label className="form-label">次アクション期限</label>
              <input
                type="date"
                className="form-input w-48"
                value={form.next_action_date}
                onChange={e => handleChange('next_action_date', e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">メモ</label>
              <textarea
                className="form-input"
                rows={3}
                value={form.memo}
                onChange={e => handleChange('memo', e.target.value)}
                placeholder="連絡履歴・備考など"
              />
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded text-sm font-semibold text-gray-900 hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: '#29e6d3' }}
          >
            {saving ? '保存中...' : isEdit ? '更新する' : '登録する'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  )
}
