import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/',              label: 'ダッシュボード', icon: '◈' },
  { path: '/events',        label: 'イベント管理',   icon: '◉' },
  { path: '/tasks',         label: 'タスク一覧',     icon: '☑' },
  { path: '/stakeholders',  label: 'ステークホルダー', icon: '◎' },
  { path: '/goals',         label: '目標・実績管理', icon: '◆' },
  { path: '/templates',     label: 'タスクテンプレート', icon: '◧' },
]

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-20"
      style={{ background: '#262526' }}
    >
      {/* ロゴ */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <p className="text-white text-xs leading-tight opacity-70">IT人材確保事業</p>
        <p className="text-white font-bold text-sm leading-tight mt-0.5">運営管理システム</p>
      </div>

      {/* ナビ */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-white font-medium'
                  : 'text-white/60 hover:text-white/90'
              }`
            }
            style={({ isActive }) =>
              isActive ? { background: '#29e6d3', color: '#1a1a1a', fontWeight: '600' } : {}
            }
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* バージョン */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-white/30 text-xs">v1.0.0 Phase 1</p>
      </div>
    </aside>
  )
}
