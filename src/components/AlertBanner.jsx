import { T } from '../constants/theme'
import { Icon } from './Icons'

export default function AlertBanner({ overdueTasks, soonTasks, onConfirm }) {
  if (overdueTasks === 0 && soonTasks === 0) return null
  return (
    <div style={{
      background: '#fff8f1', borderBottom: `1px solid ${T.warningBg}`,
      padding: '10px 28px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: T.warning, display: 'inline-flex' }}>{Icon.alert(16)}</span>
      <span style={{ fontSize: 13, color: '#9a3412', fontWeight: 500 }}>
        {overdueTasks > 0 && <>期限超過タスク <strong style={{ fontWeight: 700 }}>{overdueTasks}件</strong></>}
        {overdueTasks > 0 && soonTasks > 0 && <span style={{ margin: '0 8px', color: T.faint }}>·</span>}
        {soonTasks > 0 && <>3日以内に期限のタスク <strong style={{ fontWeight: 700 }}>{soonTasks}件</strong></>}
      </span>
      {onConfirm && (
        <button
          onClick={onConfirm}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: T.warning, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
        >
          確認する {Icon.chevR(12)}
        </button>
      )}
    </div>
  )
}
