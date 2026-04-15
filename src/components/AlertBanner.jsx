// 期限超過・直近タスクのアラートバナー
export default function AlertBanner({ overdueTasks, soonTasks }) {
  if (overdueTasks === 0 && soonTasks === 0) return null

  return (
    <div className="bg-red-600 text-white px-6 py-3 flex items-center gap-4 text-sm font-medium">
      <span className="text-lg">⚠</span>
      <div className="flex gap-6">
        {overdueTasks > 0 && (
          <span>期限超過タスク <strong>{overdueTasks}件</strong></span>
        )}
        {soonTasks > 0 && (
          <span>3日以内に期限のタスク <strong>{soonTasks}件</strong></span>
        )}
      </div>
    </div>
  )
}
