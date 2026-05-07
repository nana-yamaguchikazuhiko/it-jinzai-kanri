import { T } from '../constants/theme'
import { SMALL_CAT_MAP } from '../constants/categories'

export const CAT_DEFS = {
  enterprise: { label: '企業向け支援活動', short: '企', color: T.catA, bg: T.catABg },
  student:    { label: '学生向け啓蒙活動', short: '学', color: T.catB, bg: T.catBBg },
  education:  { label: '教育機関との連携', short: '教', color: T.catC, bg: T.catCBg },
  recruiting: { label: '採用支援',         short: '採', color: T.catD, bg: T.catDBg },
}

// small_cat → 4分類キー
const RECRUITING_SMALLS = new Set(['新卒者対象企業説明会', '採用促進型インターンシップ・イベント'])

export function getEventCatKey(smallCat) {
  const m = SMALL_CAT_MAP[smallCat]
  if (!m) return 'enterprise'
  if (m.bigName === '学生向け啓蒙活動') return 'student'
  if (m.bigName === '教育機関との連携活動') return 'education'
  if (RECRUITING_SMALLS.has(smallCat)) return 'recruiting'
  return 'enterprise'
}

export default function CategoryChip({ cat, size = 'sm' }) {
  const c = CAT_DEFS[cat]
  if (!c) return null
  const dim = { xs: 18, sm: 22, md: 26 }[size] || 22
  const fs  = { xs: 10, sm: 11, md: 13 }[size] || 11
  return (
    <span title={c.label} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: dim, height: dim, borderRadius: 6,
      background: c.bg, color: c.color,
      fontSize: fs, fontWeight: 700, flexShrink: 0,
    }}>{c.short}</span>
  )
}

export function CategoryLegend({ style = {} }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', ...style }}>
      {Object.values(CAT_DEFS).map(c => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6, background: c.bg, color: c.color,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{c.short}</span>
          <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 500 }}>{c.label}</span>
        </div>
      ))}
    </div>
  )
}
