import { useState, useEffect } from 'react'

const SESSION_KEY = 'it_mgmt_auth'

export default function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  // セッション確認（ページリロード時）
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved === 'true') setAuthed(true)
    setChecking(false)
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/.netlify/functions/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (data.ok) {
        sessionStorage.setItem(SESSION_KEY, 'true')
        setAuthed(true)
      } else {
        setError('IDまたはパスワードが違います')
        setPassword('')
      }
    } catch {
      setError('認証サーバーに接続できません')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return null

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F4F0' }}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 w-80">
          <div className="mb-6 text-center">
            <p className="text-xs text-gray-400 mb-1">IT人材確保事業</p>
            <h1 className="text-lg font-bold text-gray-800">運営管理システム</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="form-label">ユーザーID</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">パスワード</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2 rounded text-sm font-semibold text-gray-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ background: '#06b6d4' }}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return children
}
