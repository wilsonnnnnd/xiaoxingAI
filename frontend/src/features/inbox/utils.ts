import type {
  EmailCategory,
  EmailPriority,
  EmailProcessingStatus,
  EmailSuggestedAction,
} from '../../types'

export function getBadgeVariantForPriority(priority: EmailPriority) {
  if (priority === 'high') return 'error' as const
  if (priority === 'medium') return 'warning' as const
  return 'neutral' as const
}

export function getBadgeVariantForCategory(category: EmailCategory) {
  if (category === 'job') return 'info' as const
  if (category === 'finance') return 'warning' as const
  if (category === 'social') return 'success' as const
  if (category === 'spam') return 'error' as const
  return 'neutral' as const
}

export function getBadgeVariantForAction(action: EmailSuggestedAction) {
  if (action === 'reply') return 'info' as const
  if (action === 'notify') return 'warning' as const
  if (action === 'review') return 'neutral' as const
  if (action === 'archive') return 'success' as const
  return 'neutral' as const
}

export function getBadgeVariantForStatus(status: EmailProcessingStatus | string) {
  if (status === 'processed') return 'success' as const
  if (status === 'processed_with_fallback') return 'warning' as const
  if (status === 'partially_failed') return 'warning' as const
  if (status === 'failed') return 'error' as const
  return 'neutral' as const
}

export function formatProcessedAt(value: string, locale: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
