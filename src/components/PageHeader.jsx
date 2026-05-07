import { T } from '../constants/theme'

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.border}`, gap: 16,
    }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: T.ink, letterSpacing: '-0.005em' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 12, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  )
}
