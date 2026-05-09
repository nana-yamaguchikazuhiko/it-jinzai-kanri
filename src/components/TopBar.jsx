import { T } from '../constants/theme'
import NotificationBell from './NotificationBell'

export default function TopBar({ children }) {
  return (
    <div style={{
      background: T.surface, borderBottom: `1px solid ${T.border}`,
      padding: '0 28px', height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>
        {children}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NotificationBell />
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: T.teal, color: '#fff', fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>D</div>
      </div>
    </div>
  )
}
