import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Clock, ExternalLink, MessageCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import clsx from 'clsx'

const STATUS_CONFIG = {
  done: {
    icon: CheckCircle2,
    label: 'הושלם',
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    badge: 'badge-success',
  },
  in_progress: {
    icon: Clock,
    label: 'בתהליך',
    color: 'text-primary-500',
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-200 dark:border-primary-800',
    badge: 'badge-primary',
  },
  pending: {
    icon: Circle,
    label: 'ממתין',
    color: 'text-gray-400',
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  },
}

const PRIORITY_DOT = {
  high: 'bg-orange-400',
  medium: 'bg-yellow-300',
  low: 'bg-gray-300',
}

export default function TaskCard({ task, onStatusChange, isAdmin = false }) {
  const [expanded, setExpanded] = useState(false)
  const [justDone, setJustDone] = useState(false)
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const StatusIcon = config.icon

  const handleWhatsApp = (e) => {
    e.stopPropagation()
    const digits = task.whatsappPhone.replace(/\D/g, '')
    const e164 = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '')
    window.open(`https://wa.me/${e164}`, '_blank')
  }

  const handleToggleStatus = (e) => {
    e.stopPropagation()
    if (!onStatusChange || task.status === 'done') return
    const next = task.status === 'pending' ? 'in_progress' : 'done'
    if (next === 'done') {
      setJustDone(true)
      setTimeout(() => setJustDone(false), 700)
    }
    onStatusChange(task.id, next)
  }

  return (
    <div
      className={clsx(
        'card border transition-[box-shadow,opacity] duration-200',
        config.border,
        task.status === 'done' ? 'opacity-75' : ''
      )}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Status toggle button */}
          <button
            onClick={handleToggleStatus}
            className={clsx(
              'mt-0.5 flex-shrink-0 transition-[color,scale] duration-150',
              config.color,
              justDone && 'animate-check-done',
              task.status !== 'done' && !isAdmin && 'hover:scale-110'
            )}
            disabled={isAdmin}
            title={isAdmin ? '' : 'לחץ לעדכון סטטוס'}
          >
            <StatusIcon size={22} />
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={clsx(
                'text-sm font-semibold leading-tight',
                task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'
              )}>
                {task.title}
              </h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {task.priority && task.status !== 'done' && (
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority])} />
                )}
                <span className={clsx(config.badge, 'badge text-xs')}>
                  {config.label}
                </span>
              </div>
            </div>

            {task.dueDate && (
              <div className="flex items-center gap-1 mt-1.5">
                <Clock size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  יעד: {new Date(task.dueDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                </span>
              </div>
            )}
          </div>

          {/* Expand toggle */}
          <button className="text-gray-400 flex-shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className={clsx('border-t px-4 pb-4 pt-3 space-y-3', config.border, config.bg)}>
          {task.description && (
            <p className="text-sm text-gray-700 leading-relaxed dark:text-gray-200">{task.description}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {task.linkedFormId && !isAdmin && (
              <Link
                to={`/forms/fill/${task.linkedFormId}`}
                className="flex items-center gap-1.5 text-xs text-white bg-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-[background-color] duration-150 font-medium"
              >
                <FileText size={13} />
                מלא טופס
              </Link>
            )}
            {task.formFileUrl && (
              <a
                href={task.formFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-[background-color] duration-150 dark:bg-primary-900/30 dark:text-primary-300"
              >
                <FileText size={13} />
                פתח טופס
              </a>
            )}
            {task.resourceUrl && (
              <a
                href={task.resourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 bg-white border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-[background-color] duration-150 dark:bg-gray-800 dark:hover:bg-primary-900/30"
              >
                <ExternalLink size={13} />
                פתח קישור
              </a>
            )}
            {task.whatsappPhone && (
              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-[background-color] duration-150 dark:bg-green-900/20 dark:text-green-300"
              >
                <MessageCircle size={13} />
                שלח וואטסאפ
              </button>
            )}
          </div>

          {task.completedAt && (
            <p className="text-xs text-green-600 dark:text-green-400">
              ✓ הושלם ב-{new Date(task.completedAt).toLocaleDateString('he-IL')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
