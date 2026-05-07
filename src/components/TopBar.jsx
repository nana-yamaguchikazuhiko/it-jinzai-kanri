import { T } from '../constants/theme'
import { Icon } from './Icons'

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
        <button style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${T.border}`,
          background: T.surface, color: T.inkSoft,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', cursor: 'pointer',
        }}>
          {Icon.bell(16)}
          <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: T.danger, border: `1.5px solid ${T.surface}` }} />
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: T.teal, color: '#fff', fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>YN</div>
      </div>
    </div>
  )
}
