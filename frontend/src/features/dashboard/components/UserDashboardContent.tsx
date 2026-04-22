import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { Badge } from '../../../components/common/Badge'
import { Card } from '../../../components/common/Card'
import { useI18n } from '../../../i18n/useI18n'
import type { LogEntry, UserDashboardPayload, WorkerUserStatus } from '../../../types'
import { getUserDashboard } from '../api'
import { LineChart } from './LineChart'

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral'

function fmtNumber(n: number | null | undefined) {
  if (n === null || n === undefined) return '-'
  const v = Number(n)
  if (!Number.isFinite(v)) return '-'
  return v.toLocaleString()
}

function fmtCurrency(n: number | null | undefined) {
  if (n === null || n === undefined) return '-'
  const v = Number(n)
  if (!Number.isFinite(v)) return '-'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(v)
}

function fmtTimestamp(ts: string | null | undefined) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

function levelVariant(level: string): BadgeVariant {
  if (level === 'error') return 'error'
  if (level === 'warning') return 'warning'
  if (level === 'info') return 'info'
  return 'neutral'
}

function workerBadge(worker: WorkerUserStatus | undefined, t: (key: string) => string) {
  if (!worker) return { label: t('dashboard.placeholder.unknown'), variant: 'neutral' as BadgeVariant }
  if (worker.running) return { label: t('userDashboard.worker.running'), variant: 'success' as BadgeVariant }
  if (worker.worker_enabled) return { label: t('userDashboard.worker.enabled_idle'), variant: 'warning' as BadgeVariant }
  return { label: t('userDashboard.worker.stopped'), variant: 'neutral' as BadgeVariant }
}

function MetricTile({
  label,
  value,
  note,
  status,
}: {
  label: string
  value: string
  note: string
  status?: { label: string; variant: BadgeVariant }
}) {
  return (
    <div
      className={[
        'rounded-[22px] border border-white/70 bg-white/70 p-5 backdrop-blur-xl',
        'ring-1 ring-black/[0.03]',
        'shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
        'bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.12)_42%,transparent)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
          {label}
        </div>
        {status ? <Badge variant={status.variant}>{status.label}</Badge> : null}
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900 tabular-nums">
        {value}
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-500">{note}</div>
    </div>
  )
}

function StatusRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-slate-500">{label}</div>
      <div className="text-right font-medium text-slate-800 tabular-nums">{value}</div>
    </div>
  )
}

function ActivityItem({
  log,
  logTypeLabel,
  noTimestampLabel,
  tokensLabel,
}: {
  log: LogEntry
  logTypeLabel: string
  noTimestampLabel: string
  tokensLabel: string
}) {
  const timestamp = fmtTimestamp(log.ts) || noTimestampLabel

  return (
    <div className="rounded-[18px] border border-white/70 bg-white/58 px-4 py-3 ring-1 ring-black/[0.02]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={levelVariant(log.level)}>{log.level}</Badge>
            <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {logTypeLabel}: {log.log_type}
            </span>
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-700">{log.msg}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-slate-500 tabular-nums">{timestamp}</div>
          {log.tokens > 0 ? (
            <div className="mt-2 text-[11px] text-slate-400 tabular-nums">
              {fmtNumber(log.tokens)} {tokensLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  to,
  label,
  body,
}: {
  to: string
  label: string
  body: string
}) {
  return (
    <Link
      to={to}
      className="rounded-[18px] border border-white/70 bg-white/60 px-4 py-3 text-left ring-1 ring-black/[0.03] transition hover:bg-white/78"
    >
      <div className="text-sm font-medium text-slate-800">{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{body}</div>
    </Link>
  )
}

export function UserDashboardContent() {
  const { t } = useI18n()
  const token = localStorage.getItem('auth_token')

  const { data, isLoading } = useQuery({
    queryKey: ['user-dashboard', 30],
    queryFn: () => getUserDashboard(30),
    staleTime: 20_000,
    enabled: !!token,
    refetchOnWindowFocus: false,
  })

  const payload = data as UserDashboardPayload | undefined
  const summary = payload?.summary
  const worker = payload?.operational?.worker_status
  const recentLogs = (payload?.recent_logs ?? []).slice(-8).reverse()
  const workerState = workerBadge(worker, t)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {t('nav.dashboard')}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
              {t('userDashboard.title')}
            </h1>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              {t('userDashboard.subtitle')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">{t('userDashboard.badge.personal')}</Badge>
            <Badge variant={isLoading ? 'neutral' : 'success'}>
              {isLoading ? t('dashboard.loading') : t('dashboard.live')}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricTile
            label={t('userDashboard.kpi.emails_processed')}
            value={fmtNumber(summary?.total_emails_processed)}
            note={t('userDashboard.note.emails_processed')}
          />
          <MetricTile
            label={t('userDashboard.kpi.processed_today')}
            value={fmtNumber(summary?.processed_today)}
            note={t('userDashboard.note.processed_today')}
            status={{ label: t('userDashboard.badge.today'), variant: 'info' }}
          />
          <MetricTile
            label={t('userDashboard.kpi.tokens_used')}
            value={fmtNumber(summary?.total_tokens_used)}
            note={t('userDashboard.note.tokens_used')}
          />
          <MetricTile
            label={t('userDashboard.kpi.estimated_cost')}
            value={fmtCurrency(summary?.estimated_cost_usd)}
            note={payload?.notes?.estimated_cost ?? t('dashboard.placeholder.not_available')}
            status={{ label: t('dashboard.badge.tracked'), variant: 'info' }}
          />
          <MetricTile
            label={t('userDashboard.kpi.worker_status')}
            value={worker?.running ? t('userDashboard.worker.running') : t('userDashboard.worker.stopped')}
            note={
              worker?.last_poll
                ? `${t('userDashboard.note.last_poll')}: ${fmtTimestamp(worker.last_poll)}`
                : t('userDashboard.note.worker_status')
            }
            status={workerState}
          />
          <MetricTile
            label={t('userDashboard.kpi.plan_status')}
            value={payload?.membership?.plan_name ?? t('dashboard.placeholder.pending')}
            note={payload?.membership?.note ?? t('dashboard.placeholder.pending_billing')}
            status={{ label: t('dashboard.badge.billing'), variant: 'neutral' }}
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card
            subtitle={t('dashboard.section.usage')}
            title={t('userDashboard.chart.token_usage')}
            rightSlot={<Badge variant="neutral">{t('dashboard.badge.last_30_days')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('userDashboard.chart.token_usage_subtitle')}
            </div>
            <LineChart
              data={payload?.series?.token_usage ?? []}
              stroke="rgba(79,70,229,0.72)"
              fill="rgba(235,230,255,0.55)"
              emptyTitle={t('dashboard.empty.token_usage_title')}
              emptyMessage={t('userDashboard.empty.token_usage')}
            />
          </Card>

          <Card
            subtitle={t('dashboard.section.growth')}
            title={t('userDashboard.chart.email_activity')}
            rightSlot={<Badge variant="neutral">{t('dashboard.badge.last_30_days')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('userDashboard.chart.email_activity_subtitle')}
            </div>
            <LineChart
              data={payload?.series?.emails_processed ?? []}
              stroke="rgba(11,60,93,0.72)"
              fill="rgba(217,235,255,0.55)"
              emptyTitle={t('userDashboard.empty.email_activity_title')}
              emptyMessage={t('userDashboard.empty.email_activity')}
            />
          </Card>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card
            subtitle={t('dashboard.section.business')}
            title={t('userDashboard.chart.estimated_cost')}
            rightSlot={<Badge variant="info">{t('dashboard.badge.tracked_usage')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('userDashboard.chart.estimated_cost_subtitle')}
            </div>
            <LineChart
              data={payload?.series?.estimated_cost ?? []}
              stroke="rgba(14,116,144,0.7)"
              fill="rgba(217,244,255,0.58)"
              emptyTitle={t('dashboard.empty.estimated_cost_title')}
              emptyMessage={payload?.notes?.estimated_cost ?? t('dashboard.empty.estimated_cost_message')}
            />
          </Card>

          <Card
            subtitle={t('userDashboard.section.quick_links')}
            title={t('userDashboard.quick_links.title')}
            interactive={false}
          >
            <div className="grid gap-3">
              <QuickLink
                to="/inbox"
                label={t('nav.inbox')}
                body={t('userDashboard.quick_links.inbox')}
              />
              <QuickLink
                to="/skill/gmail"
                label={t('nav.skill.gmail')}
                body={t('userDashboard.quick_links.gmail')}
              />
              <QuickLink
                to="/settings"
                label={t('nav.settings')}
                body={t('userDashboard.quick_links.settings')}
              />
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card
            subtitle={t('dashboard.section.operations')}
            title={t('userDashboard.worker.title')}
            rightSlot={<Badge variant={workerState.variant}>{workerState.label}</Badge>}
            interactive={false}
          >
            <div className="grid gap-3 text-sm text-slate-700">
              <StatusRow
                label={t('userDashboard.worker.worker_enabled')}
                value={worker?.worker_enabled ? t('userDashboard.worker.enabled') : t('userDashboard.worker.disabled')}
              />
              <StatusRow
                label={t('userDashboard.worker.last_poll')}
                value={fmtTimestamp(worker?.last_poll) || t('dashboard.placeholder.no_activity_yet')}
              />
              <StatusRow
                label={t('userDashboard.worker.interval')}
                value={worker?.interval ? `${fmtNumber(worker.interval)}s` : '-'}
              />
              <StatusRow
                label={t('userDashboard.worker.total_errors')}
                value={fmtNumber(worker?.total_errors)}
              />
              <StatusRow
                label={t('userDashboard.worker.priorities')}
                value={worker?.priorities?.length ? worker.priorities.join(', ') : '-'}
              />
            </div>
          </Card>

          <Card
            subtitle={t('dashboard.section.operations')}
            title={t('dashboard.activity.title')}
            rightSlot={<Badge variant="neutral">{t('userDashboard.badge.personal_activity')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('userDashboard.activity.subtitle')}
            </div>
            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                  {t('userDashboard.activity.empty')}
                </div>
              ) : (
                recentLogs.map(log => (
                  <ActivityItem
                    key={log.id}
                    log={log}
                    logTypeLabel={t('dashboard.activity.log_type')}
                    noTimestampLabel={t('dashboard.placeholder.no_activity_yet')}
                    tokensLabel={t('dashboard.users.tokens')}
                  />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
