import { NavLink } from 'react-router-dom'
import { T } from '../constants/theme'
import { Icon } from './Icons'

const NAV_ITEMS = [
  { path: '/',             label: 'ダッシュボード',          icon: Icon.dashboard },
  { path: '/fieldnotes',   label: 'フィールドノート',        icon: Icon.note      },
  { path: '/events',       label: 'イベント管理',            icon: Icon.event     },
  { path: '/tasks',        label: 'タスク一覧',              icon: Icon.task      },
  { path: '/budget',       label: '予算管理',                icon: Icon.yen       },
  { path: '/stakeholders', label: 'ステークホルダー',        icon: Icon.users     },
  { path: '/goals',        label: '目標・実績管理',          icon: Icon.target    },
  { path: '/mails',        label: '問い合わせ管理',          icon: Icon.mail,     suffix: '実装中' },
  { path: '/templates',    label: 'タスクテンプレート',      icon: Icon.template  },
  { path: '/snippets',          label: 'スニペット',              icon: Icon.code      },
  { path: '/content-templates', label: 'コンテンツテンプレート',  icon: Icon.note      },
]

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-20"
      style={{ width: 232, background: T.sidebar }}
    >
      {/* ブランド */}
      <div style={{ padding: '22px 22px 18px' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.14em', marginBottom: 4, textTransform: 'uppercase' }}>
          MISA人財確保事業
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>
          運営管理システム
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 16px 8px' }} />

      {/* ナビ */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '4px 12px' }}>
        {NAV_ITEMS.map(({ path, label, icon, suffix }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px', margin: '1px 0', borderRadius: 4,
              background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13, position: 'relative',
              textDecoration: 'none', cursor: 'pointer',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, background: T.teal, borderRadius: '0 2px 2px 0' }} />
                )}
                <span style={{ display: 'inline-flex', opacity: isActive ? 1 : 0.55, flexShrink: 0 }}>
                  {icon(15)}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {suffix && (
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{suffix}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* バージョン */}
      <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        v1.0.0 · Phase 1
      </div>
    </aside>
  )
}
