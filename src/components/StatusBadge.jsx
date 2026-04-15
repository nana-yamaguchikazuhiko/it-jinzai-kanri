// イベント・タスク・ステークホルダーのステータスバッジ

const EVENT_STATUS_STYLES = {
  '要対応': 'bg-red-100 text-red-700 border border-red-200',
  '注意':   'bg-yellow-100 text-yellow-700 border border-yellow-200',
  '順調':   'bg-green-100 text-green-700 border border-green-200',
  '計画中': 'bg-blue-100 text-blue-700 border border-blue-200',
  '完了':   'bg-gray-100 text-gray-600 border border-gray-200',
}

const TASK_STATUS_STYLES = {
  '未着手': 'bg-gray-100 text-gray-600',
  '進行中': 'bg-blue-100 text-blue-700',
  '完了':   'bg-green-100 text-green-700',
  '期限超過': 'bg-red-100 text-red-700',
}

const CONTACT_STATUS_STYLES = {
  '未連絡':   'bg-gray-100 text-gray-600',
  '連絡中':   'bg-blue-100 text-blue-700',
  '送付済':   'bg-yellow-100 text-yellow-700',
  '回答済':   'bg-green-100 text-green-700',
}

export function EventStatusBadge({ status }) {
  const cls = EVENT_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${cls}`}>
      {status || '—'}
    </span>
  )
}

export function TaskStatusBadge({ status }) {
  const cls = TASK_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${cls}`}>
      {status || '—'}
    </span>
  )
}

export function ContactStatusBadge({ status }) {
  const cls = CONTACT_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${cls}`}>
      {status || '—'}
    </span>
  )
}

// 優先度バッジ
export function PriorityBadge({ priority }) {
  const styles = {
    '高': 'bg-red-100 text-red-700',
    '中': 'bg-yellow-100 text-yellow-700',
    '低': 'bg-gray-100 text-gray-500',
  }
  const cls = styles[priority] || 'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${cls}`}>
      {priority || '—'}
    </span>
  )
}
