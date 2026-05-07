import { T } from '../constants/theme'

const KINDS = {
  primary: { bg: T.teal,        fg: '#fff',      bd: T.teal        },
  ghost:   { bg: 'transparent', fg: T.inkSoft,   bd: T.border      },
  danger:  { bg: '#fff',        fg: T.danger,    bd: '#fecaca'     },
  soft:    { bg: T.tealBg,      fg: T.teal,      bd: 'transparent' },
}
const SIZES = {
  sm: { fs: 12, py: 6,  px: 12 },
  md: { fs: 13, py: 8,  px: 16 },
  lg: { fs: 14, py: 10, px: 20 },
}

export default function Btn({ kind = 'primary', size = 'md', children, icon, style: ext = {}, ...rest }) {
  const k  = KINDS[kind] || KINDS.primary
  const sz = SIZES[size] || SIZES.md
  return (
    <button {...rest} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: `${sz.py}px ${sz.px}px`, fontSize: sz.fs, fontWeight: 600,
      borderRadius: 8, border: `1px solid ${k.bd}`,
      background: k.bg, color: k.fg,
      cursor: 'pointer', fontFamily: 'inherit',
      transition: 'opacity 0.15s',
      ...ext,
    }}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      {children}
    </button>
  )
}
