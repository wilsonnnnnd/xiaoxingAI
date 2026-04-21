import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Surface } from '../../../components/common/Surface'
import { Card } from '../../../components/common/Card'
import { Badge } from '../../../components/common/Badge'
import { Select } from '../../../components/common/Select'
import { Button } from '../../../components/common/Button'
import { InputField } from '../../../components/common/InputField'
import { useI18n } from '../../../i18n/useI18n'
import type { EmailCategory, EmailPriority, ProcessedEmailListItem } from '../../../types'
import { getProcessedEmails, getProcessedEmailStats } from '../api'
import { ProcessedEmailDetailModal } from './ProcessedEmailDetailModal'
import {
  formatProcessedAt,
  getBadgeVariantForAction,
  getBadgeVariantForCategory,
  getBadgeVariantForPriority,
  getBadgeVariantForStatus,
} from '../utils'

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const PRIORITY_OPTIONS: Array<{ labelKey: string; value: EmailPriority }> = [
  { labelKey: 'opt.priority.high', value: 'high' },
  { labelKey: 'opt.priority.medium', value: 'medium' },
  { labelKey: 'opt.priority.low', value: 'low' },
]

const CATEGORY_OPTIONS: Array<{ labelKey: string; value: EmailCategory }> = [
  { labelKey: 'inbox.category.job', value: 'job' },
  { labelKey: 'inbox.category.finance', value: 'finance' },
  { labelKey: 'inbox.category.social', value: 'social' },
  { labelKey: 'inbox.category.spam', value: 'spam' },
  { labelKey: 'inbox.category.other', value: 'other' },
]

const safeT = (t: (key: string) => string, key: string, fallback: string) => {
  const value = t(key)
  if (!value || value === key) return fallback
  return value
}

const shortSender = (sender: string) => {
  const s = String(sender || '').trim()
  if (!s) return { short: '', full: '' }
  const m = s.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  if (m) {
    const name = (m[1] || '').trim()
    const email = (m[2] || '').trim()
    return {
      short: name || email,
      full: `${name ? `${name} ` : ''}<${email}>`,
    }
  }
  return { short: s, full: s }
}

const EmailRow: React.FC<{
  item: ProcessedEmailListItem
  locale: string
  t: (key: string) => string
  lang: string
  onOpen: (id: number) => void
}> = ({ item, locale, t, lang, onOpen }) => {
  const [senderExpanded, setSenderExpanded] = useState(false)
  const sender = useMemo(() => shortSender(item.sender), [item.sender])
  const unknown = lang === 'zh' ? '未知' : 'Unknown'
  const statusLabel = item.processing_status
    ? safeT(t, `inbox.status.${item.processing_status}`, item.processing_status)
    : unknown
  const categoryLabel = safeT(t, `inbox.category.${item.category}`, item.category)
  const priorityLabel = safeT(t, `inbox.priority.${item.priority}`, item.priority)
  const actionLabel = safeT(t, `inbox.action.${item.suggested_action}`, item.suggested_action)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(item.id)
        }
      }}
      className="rounded-[24px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30"
      aria-label={t('inbox.detail.open_label').replace('{subject}', item.subject || t('inbox.no_subject'))}
    >
      <Card
        interactive
        title={item.subject || t('inbox.no_subject')}
        subtitle={(sender.short || item.sender) || t('inbox.unknown_sender')}
        rightSlot={
          item.has_reply_drafts ? (
            <Badge variant="info">{t('inbox.reply_drafts_ready')}</Badge>
          ) : null
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-7 text-slate-600 break-words [overflow-wrap:anywhere] line-clamp-2">
            {item.summary || t('inbox.no_summary')}
          </p>

          <div className="flex flex-wrap gap-2">
            <Badge variant={getBadgeVariantForCategory(item.category)}>
              {categoryLabel}
            </Badge>
            <Badge variant={getBadgeVariantForPriority(item.priority)}>
              {priorityLabel}
            </Badge>
            <Badge variant={getBadgeVariantForAction(item.suggested_action)}>
              {actionLabel}
            </Badge>
            <Badge variant={getBadgeVariantForStatus(item.processing_status)}>
              {statusLabel}
            </Badge>
          </div>

          <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-3 ring-1 ring-black/[0.03]">
              <div className="uppercase tracking-[0.16em] text-[10px]">{t('inbox.meta.sender')}</div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setSenderExpanded((v) => !v)
                }}
                className="mt-1 block w-full min-w-0 text-left text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/20"
                title={sender.full || item.sender}
                aria-label={sender.full || item.sender || t('inbox.unknown_sender')}
              >
                {senderExpanded ? (
                  <span className="block break-words [overflow-wrap:anywhere]">{sender.full || item.sender}</span>
                ) : (
                  <span className="block truncate">{sender.short || item.sender || t('inbox.unknown_sender')}</span>
                )}
              </button>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-3 ring-1 ring-black/[0.03]">
              <div className="uppercase tracking-[0.16em] text-[10px]">{t('inbox.meta.processed_at')}</div>
              <div className="mt-1 text-sm text-slate-700">{formatProcessedAt(item.processed_at, locale)}</div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-3 ring-1 ring-black/[0.03]">
              <div className="uppercase tracking-[0.16em] text-[10px]">{t('inbox.meta.reply_drafts')}</div>
              <div className="mt-1 text-sm text-slate-700">
                {item.has_reply_drafts ? t('inbox.has_reply_drafts.yes') : t('inbox.has_reply_drafts.no')}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export const ProcessedEmailsPage: React.FC = () => {
  const { t, lang } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
  const pageSize = Math.max(1, Number(searchParams.get('page_size') || '20') || 20)
  const q = searchParams.get('q') || ''
  const priority = (searchParams.get('priority') || '') as EmailPriority | ''
  const category = (searchParams.get('category') || '') as EmailCategory | ''
  const hasReplyDraftsParam = searchParams.get('has_reply_drafts')
  const hasReplyDrafts =
    hasReplyDraftsParam === 'true' ? true : hasReplyDraftsParam === 'false' ? false : undefined
  const selectedEmailId = (() => {
    const raw = searchParams.get('emailId')
    if (!raw) return null
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return parsed
  })()

  const statsQuery = useQuery({
    queryKey: ['processed-email-stats'],
    queryFn: getProcessedEmailStats,
    staleTime: 60_000,
  })

  const query = useQuery({
    queryKey: ['processed-emails', page, pageSize, q, priority, category, hasReplyDrafts],
    queryFn: () =>
      getProcessedEmails({
        page,
        page_size: pageSize,
        q: q || undefined,
        priority,
        category,
        has_reply_drafts: hasReplyDrafts,
      }),
  })

  const totalPages = Math.max(1, Math.ceil((query.data?.count || 0) / pageSize))
  const locale = lang === 'zh' ? 'zh-CN' : 'en-AU'

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([key, value]) => {
      if (!value) next.delete(key)
      else next.set(key, value)
    })
    setSearchParams(next)
  }

  const handleFilterChange = (patch: Record<string, string | undefined>) => {
    updateParams({ ...patch, page: '1' })
  }

  const openEmail = (id: number) => {
    updateParams({ emailId: String(id) })
  }

  const stats = statsQuery.data

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-5">
        <Surface
          title={t('inbox.title')}
          eyebrow={t('nav.inbox')}
          badge={query.data ? `${query.data.count} ${t('inbox.results')}` : t('inbox.subtitle')}
        >
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                interactive={false}
                subtitle={t('inbox.stats.processed_today')}
                title={stats ? String(stats.processed_today) : '—'}
              />
              <Card
                interactive={false}
                subtitle={t('inbox.stats.high_priority')}
                title={stats ? String(stats.high_priority) : '—'}
              />
              <Card
                interactive={false}
                subtitle={t('inbox.stats.with_reply_drafts')}
                title={stats ? String(stats.with_reply_drafts) : '—'}
              />
              <Card
                interactive={false}
                subtitle={t('inbox.stats.active_rules')}
                title={stats ? String(stats.active_rules) : '—'}
              />
            </div>
            <InputField
              label={t('inbox.search.label')}
              value={q}
              type="search"
              placeholder={t('inbox.search.placeholder')}
              onChange={(value) => handleFilterChange({ q: value.trim() ? value.trim() : undefined })}
            />
            <div className="grid gap-3 md:grid-cols-4">
              <Select
                label={t('inbox.filters.priority')}
                value={priority}
                onChange={(e) => handleFilterChange({ priority: e.target.value || undefined })}
                options={[
                  { label: t('inbox.filters.all'), value: '' },
                  ...PRIORITY_OPTIONS.map((opt) => ({ label: t(opt.labelKey), value: opt.value })),
                ]}
              />
              <Select
                label={t('inbox.filters.category')}
                value={category}
                onChange={(e) => handleFilterChange({ category: e.target.value || undefined })}
                options={[
                  { label: t('inbox.filters.all'), value: '' },
                  ...CATEGORY_OPTIONS.map((opt) => ({ label: t(opt.labelKey), value: opt.value })),
                ]}
              />
              <Select
                label={t('inbox.filters.reply_drafts')}
                value={hasReplyDrafts === true ? 'true' : hasReplyDrafts === false ? 'false' : ''}
                onChange={(e) => handleFilterChange({ has_reply_drafts: e.target.value || undefined })}
                options={[
                  { label: t('inbox.filters.all'), value: '' },
                  { label: t('inbox.has_reply_drafts.yes'), value: 'true' },
                  { label: t('inbox.has_reply_drafts.no'), value: 'false' },
                ]}
              />
              <Select
                label={t('inbox.filters.page_size')}
                value={String(pageSize)}
                onChange={(e) => handleFilterChange({ page_size: e.target.value || '20' })}
                options={PAGE_SIZE_OPTIONS.map((size) => ({ label: String(size), value: String(size) }))}
              />
            </div>
          </div>
        </Surface>

        {query.isLoading ? (
          <Card interactive={false} title={t('inbox.loading_title')} subtitle={t('inbox.loading_subtitle')}>
            <div className="space-y-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-28 animate-pulse rounded-[22px] border border-white/70 bg-white/55"
                />
              ))}
            </div>
          </Card>
        ) : query.isError ? (
          <Card interactive={false} title={t('inbox.error_title')} subtitle={t('inbox.error_subtitle')}>
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-slate-600">{t('inbox.error_body')}</p>
              <Button variant="secondary" onClick={() => query.refetch()}>
                {t('inbox.retry')}
              </Button>
            </div>
          </Card>
        ) : query.data && query.data.emails.length === 0 ? (
          <Card interactive={false} title={t('inbox.empty_title')} subtitle={t('inbox.empty_subtitle')}>
            <p className="text-sm text-slate-600">{t('inbox.empty_body')}</p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4">
              {query.data?.emails.map((item) => (
                <EmailRow
                  key={item.id}
                  item={item}
                  locale={locale}
                  t={t}
                  lang={lang}
                  onOpen={openEmail}
                />
              ))}
            </div>

            <div className="flex flex-col items-stretch justify-between gap-3 rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:flex-row sm:items-center">
              <div className="text-sm text-slate-600">
                {t('inbox.pagination.summary')
                  .replace('{page}', String(page))
                  .replace('{pages}', String(totalPages))
                  .replace('{count}', String(query.data?.count || 0))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                >
                  {t('inbox.pagination.previous')}
                </Button>
                <div className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm text-slate-700 ring-1 ring-black/[0.03]">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                >
                  {t('inbox.pagination.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <ProcessedEmailDetailModal
        emailId={selectedEmailId}
        isOpen={selectedEmailId != null}
        onClose={() => updateParams({ emailId: undefined })}
      />
    </div>
  )
}
