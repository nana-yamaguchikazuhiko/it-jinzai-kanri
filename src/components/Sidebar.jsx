import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/',             label: 'ダッシュボード',    icon: '⊞' },
  { path: '/events',       label: 'イベント管理',      icon: '◈' },
  { path: '/tasks',        label: 'タスク一覧',        icon: '☑' },
  { path: '/budget',       label: '予算管理',          icon: '¥' },
  { path: '/stakeholders', label: 'ステークホルダー',  icon: '◎' },
  { path: '/goals',        label: '目標・実績管理',    icon: '◉' },
  { path: '/templates',    label: 'タスクテンプレート', icon: '▤' },
  { path: '/mails',        label: '問い合わせ管理',     icon: '✉' },
  { path: '/snippets',    label: 'スニペット',         icon: '〈〉' },
  { path: '/fieldnotes', label: 'フィールドノート',   icon: '✎' },
]

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-20"
      style={{ width: 228, background: '#0f1c2e' }}
    >
      {/* ブランド */}
      <div style={{ padding: '28px 22px 22px' }}>
        <p style={{ fontSize: 9, color: 'rgba(6,182,212,0.7)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          MISA人材確保事業
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          運営管理システム
        </p>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 22px 12px' }} />

      {/* ナビ */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '4px 0' }}>
        {NAV_ITEMS.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 22px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#06b6d4' : 'rgba(255,255,255,0.5)',
              background: isActive ? 'rgba(6,182,212,0.15)' : 'transparent',
              borderLeft: isActive ? '3px solid #06b6d4' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'color 0.15s, background 0.15s',
            })}
          >
            <span style={{ fontSize: 13 }}>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* バージョン */}
      <div style={{ padding: '16px 22px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>v1.0.0 Phase 1</p>
      </div>
    </aside>
  )
}
