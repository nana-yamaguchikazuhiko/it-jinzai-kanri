import { T } from '../constants/theme'

const TONES = {
  neutral: { bg: '#f1f3f5', fg: '#5b6b78', dotC: '#9aa7b1' },
  teal:    { bg: T.tealBg,    fg: '#1f8975', dotC: T.teal    },
  success: { bg: T.successBg, fg: '#1f8975', dotC: T.success },
  warning: { bg: T.warningBg, fg: '#b97a1d', dotC: T.warning },
  danger:  { bg: T.dangerBg,  fg: '#a73b38', dotC: T.danger  },
  info:    { bg: T.infoBg,    fg: '#3a6f9c', dotC: T.info    },
  catA:    { bg: T.catABg, fg: '#1f8975', dotC: T.catA },
  catB:    { bg: T.catBBg, fg: '#7a5e94', dotC: T.catB },
  catC:    { bg: T.catCBg, fg: '#3a6f9c', dotC: T.catC },
  catD:    { bg: T.catDBg, fg: '#b97a1d', dotC: T.catD },
}
const SIZES = {
  xs: { fs: 10, py: 2, px: 6 },
  sm: { fs: 11, py: 3, px: 9 },
  md: { fs: 12, py: 4, px: 11 },
}

export default function Badge({ tone = 'neutral', children, dot = false, size = 'sm' }) {
  const c  = TONES[tone] || TONES.neutral
  const sz = SIZES[size] || SIZES.sm
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: sz.fs, padding: `${sz.py}px ${sz.px}px`, borderRadius: 999,
      background: c.bg, color: c.fg, fontWeight: 600, lineHeight: 1.2,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dotC, flexShrink: 0 }} />}
      {children}
    </span>
  )
}

// イベントステータス → Badge tone のマッピング
export function eventStatusTone(status) {
  const map = {
    '完了':   'success',
    '順調':   'success',
    '進行中': 'teal',
    '計画中': 'info',
    '注意':   'warning',
    '要対応': 'danger',
  }
  return map[status] || 'neutral'
}

// タスクステータス → Badge tone
export function taskStatusTone(status) {
  const map = {
    '完了':     'success',
    '進行中':   'info',
    '対応中':   'info',
    '未着手':   'neutral',
    '期限超過': 'danger',
  }
  return map[status] || 'neutral'
}

// 連絡ステータス → Badge tone
export function contactStatusTone(status) {
  const map = {
    '未連絡': 'neutral',
    '連絡中': 'info',
    '送付済': 'warning',
    '回答済': 'success',
  }
  return map[status] || 'neutral'
}
