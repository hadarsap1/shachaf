import clsx from 'clsx'

export default function StatCard({ icon: Icon, label, value, sub, color = 'primary', trend, onClick }) {
  const colorMap = {
    primary: { bg: 'bg-primary-50', iconBg: 'bg-primary-100', icon: 'text-primary-600', value: 'text-primary-700' },
    secondary: { bg: 'bg-secondary-50', iconBg: 'bg-secondary-100', icon: 'text-secondary-600', value: 'text-secondary-700' },
    accent: { bg: 'bg-accent-50', iconBg: 'bg-accent-100', icon: 'text-accent-600', value: 'text-accent-700' },
    success: { bg: 'bg-green-50', iconBg: 'bg-green-100', icon: 'text-green-600', value: 'text-green-700' },
  }
  const c = colorMap[color] || colorMap.primary

  return (
    <div
      onClick={onClick}
      className={clsx(
        'card p-4 sm:p-5 border-0 transition-[box-shadow,transform] duration-200',
        c.bg,
        onClick && 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.96] transition-[box-shadow,transform]'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={clsx('p-2.5 rounded-xl', c.iconBg)}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend !== undefined && (
          <span className={clsx(
            'text-xs font-medium px-1.5 py-0.5 rounded',
            trend >= 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
          )}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className={clsx('text-2xl font-bold tabular-nums', c.value)}>{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5 dark:text-gray-200">{label}</div>
        {sub && <div className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}
