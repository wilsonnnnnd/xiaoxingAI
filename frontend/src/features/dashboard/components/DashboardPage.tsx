import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../../../components/common/Card'
import { Badge } from '../../../components/common/Badge'
import { getMe } from '../../users/api'
import { getAdminDashboard } from '../api'
import type {
  AdminDashboardBreakdownItem,
  AdminDashboardPayload,
  AdminDashboardTopUser,
  LogEntry,
} from '../../../types'
import { LineChart, MultiLineChart } from './LineChart'
import { useI18n } from '../../../i18n/useI18n'
import { UserDashboardContent } from './UserDashboardContent'

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral'
const MODEL_STROKES = [
  'rgba(11,60,93,0.82)',
  'rgba(79,70,229,0.72)',
  'rgba(5,150,105,0.72)',
  'rgba(217,119,6,0.72)',
]

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

function fmtPercent(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '-'
  return `${Math.round(Number(n) * 1000) / 10}%`
}

function levelVariant(level: string): BadgeVariant {
  if (level === 'error') return 'error'
  if (level === 'warning') return 'warning'
  if (level === 'info') return 'info'
  return 'neutral'
}

function statusVariant(state: string | null | undefined): BadgeVariant {
  if (state === 'running') return 'success'
  if (state === 'starting') return 'warning'
  return 'neutral'
}

function cumulative(series: { date: string; value: number }[]) {
  let acc = 0
  return series.map(point => {
    acc += Number(point.value || 0)
    return { date: point.date, value: acc }
  })
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
  valueClassName = '',
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-slate-500">{label}</div>
      <div
        className={[
          'text-right font-medium text-slate-800 tabular-nums',
          valueClassName,
        ].join(' ')}
      >
        {value}
      </div>
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

function TopUserItem({
  user,
  rank,
  rankLabel,
  userPrefix,
  requestsLabel,
  tokensLabel,
  viewLabel,
}: {
  user: AdminDashboardTopUser
  rank: number
  rankLabel: string
  userPrefix: string
  requestsLabel: string
  tokensLabel: string
  viewLabel: string
}) {
  const identity = user.display_name?.trim() || user.email || `${userPrefix} ${user.user_id}`

  return (
    <div className="flex items-start justify-between gap-4 rounded-[18px] border border-white/70 bg-white/58 px-4 py-3 ring-1 ring-black/[0.02]">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-[11px] font-semibold text-sky-700">
            {rank}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">
              {identity}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
              {rankLabel} #{user.user_id}
              {user.email ? ` • ${user.email}` : ''}
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-medium text-slate-800 tabular-nums">
          {fmtCurrency(user.estimated_cost_usd)}
        </div>
        <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
          {fmtNumber(user.total_tokens)} {tokensLabel} • {fmtNumber(user.request_count)} {requestsLabel}
        </div>
        <div className="mt-3">
          <Link
            to={`/users?userId=${user.user_id}`}
            className="inline-flex items-center rounded-full border border-slate-200/70 bg-white/72 px-3 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-black/[0.03] transition hover:bg-slate-50 hover:text-slate-900"
          >
            {viewLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}

function BreakdownItem({
  item,
  totalCost,
  tokensLabel,
  requestsLabel,
  noCostLabel,
  costShareSuffix,
}: {
  item: AdminDashboardBreakdownItem
  totalCost: number
  tokensLabel: string
  requestsLabel: string
  noCostLabel: string
  costShareSuffix: string
}) {
  const share = totalCost > 0 ? Math.max(4, Math.round((item.estimated_cost_usd / totalCost) * 100)) : 0

  return (
    <div className="space-y-2 rounded-[18px] border border-white/70 bg-white/58 px-4 py-3 ring-1 ring-black/[0.02]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-800">{item.label}</div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {fmtNumber(item.total_tokens)} {tokensLabel} • {fmtNumber(item.request_count)} {requestsLabel}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-medium text-slate-800 tabular-nums">
            {fmtCurrency(item.estimated_cost_usd)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
            {totalCost > 0 ? `${share}% ${costShareSuffix}` : noCostLabel}
          </div>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(14,116,144,0.8),rgba(56,189,248,0.65))]"
          style={{ width: `${Math.min(100, share)}%` }}
        />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useI18n()
  const token = localStorage.getItem('auth_token')

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 120_000,
    enabled: !!token,
  })

  const isAdmin = me?.role === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard', 30],
    queryFn: () => getAdminDashboard(30),
    staleTime: 20_000,
    enabled: !!token && !!isAdmin,
    refetchOnWindowFocus: false,
  })

  const payload = data as AdminDashboardPayload | undefined

  const userGrowth = useMemo(() => {
    const raw = payload?.series?.user_growth ?? []
    return cumulative(raw)
  }, [payload?.series?.user_growth])

  const modelUsageSeries = useMemo(
    () =>
      (payload?.series?.model_usage ?? []).map((series, index) => ({
        ...series,
        stroke: MODEL_STROKES[index % MODEL_STROKES.length],
      })),
    [payload?.series?.model_usage],
  )

  if (meLoading) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Card
            subtitle={t('nav.dashboard')}
            title={t('dashboard.loading')}
            interactive={false}
          >
            <div className="text-sm leading-7 text-slate-600">
              {t('dashboard.loading')}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return <UserDashboardContent />
  }

  const summary = payload?.summary
  const op = payload?.operational
  const worker = op?.worker_system_status
  const tgMode = worker?.telegram_updates?.mode
  const activeWorkers = worker?.running ? 1 : 0
  const enabledWorkers = op?.worker_enabled_users ?? 0
  const recentLogs = (payload?.recent_logs ?? []).slice(-10).reverse()
  const topUsersByCost = payload?.analytics?.top_users?.by_cost ?? []
  const topUsersByTokens = payload?.analytics?.top_users?.by_tokens ?? []
  const costByModel = payload?.analytics?.cost_breakdown?.by_model ?? []
  const costByPurpose = payload?.analytics?.cost_breakdown?.by_purpose ?? []
  const totalBreakdownCost = costByModel.reduce(
    (sum, item) => sum + Number(item.estimated_cost_usd || 0),
    0,
  )

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {t('nav.dashboard')}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">
              {t('dashboard.admin_overview')}
            </h1>
            <div className="mt-2 text-sm leading-7 text-slate-600">
              {t('dashboard.hero_subtitle')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="info">{t('dashboard.system_metrics')}</Badge>
            <Badge variant={isLoading ? 'neutral' : 'success'}>
              {isLoading ? t('dashboard.loading') : t('dashboard.live')}
            </Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label={t('dashboard.kpi.total_users')}
            value={fmtNumber(summary?.total_users)}
            note={t('dashboard.note.all_accounts')}
          />
          <MetricTile
            label={t('dashboard.kpi.active_users')}
            value={fmtNumber(summary?.active_users_7d)}
            note={t('dashboard.note.active_users_7d')}
            status={{ label: t('dashboard.badge.last_7_days'), variant: 'info' }}
          />
          <MetricTile
            label={t('dashboard.kpi.new_users')}
            value={fmtNumber(summary?.new_users_7d)}
            note={t('dashboard.note.new_users_7d')}
            status={{ label: t('dashboard.badge.growth'), variant: 'success' }}
          />
          <MetricTile
            label={t('dashboard.kpi.total_emails_processed')}
            value={fmtNumber(summary?.total_emails_processed)}
            note={t('dashboard.note.total_emails_processed')}
          />
          <MetricTile
            label={t('dashboard.kpi.total_tokens_used')}
            value={fmtNumber(summary?.total_tokens_used)}
            note={t('dashboard.note.total_tokens_used')}
          />
          <MetricTile
            label={t('dashboard.kpi.workers_enabled')}
            value={fmtNumber(enabledWorkers)}
            note={t('dashboard.note.workers_enabled')}
          />
          <MetricTile
            label={t('dashboard.kpi.estimated_cost')}
            value={fmtCurrency(summary?.estimated_cost_usd)}
            note={payload?.notes?.estimated_cost ?? t('dashboard.placeholder.not_available')}
            status={{ label: t('dashboard.badge.tracked'), variant: 'info' }}
          />
          <MetricTile
            label={t('dashboard.kpi.paid_members')}
            value={
              summary?.paid_members == null
                ? t('dashboard.placeholder.pending')
                : fmtNumber(summary.paid_members)
            }
            note={payload?.membership?.note ?? t('dashboard.placeholder.pending_billing')}
            status={{ label: t('dashboard.badge.billing'), variant: 'neutral' }}
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card
            subtitle={t('dashboard.section.growth')}
            title={t('dashboard.chart.user_growth')}
            rightSlot={<Badge variant="neutral">{t('dashboard.badge.last_30_days')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.chart.user_growth_subtitle')}
            </div>
            <LineChart
              data={userGrowth}
              emptyTitle={t('dashboard.empty.user_growth_title')}
              emptyMessage={t('dashboard.empty.user_growth_message')}
            />
          </Card>

          <Card
            subtitle={t('dashboard.section.usage')}
            title={t('dashboard.chart.token_usage')}
            rightSlot={<Badge variant="neutral">{t('dashboard.badge.last_30_days')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.chart.token_usage_subtitle')}
            </div>
            <LineChart
              data={payload?.series?.token_usage ?? []}
              stroke="rgba(79,70,229,0.72)"
              fill="rgba(235,230,255,0.55)"
              emptyTitle={t('dashboard.empty.token_usage_title')}
              emptyMessage={t('dashboard.empty.token_usage_message')}
            />
          </Card>

          <Card
            subtitle={t('dashboard.section.business')}
            title={t('dashboard.chart.estimated_cost')}
            rightSlot={<Badge variant="info">{t('dashboard.badge.tracked_usage')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.chart.estimated_cost_subtitle')}
            </div>
            <LineChart
              data={payload?.series?.estimated_cost ?? []}
              stroke="rgba(14,116,144,0.7)"
              fill="rgba(217,244,255,0.58)"
              emptyTitle={t('dashboard.empty.estimated_cost_title')}
              emptyMessage={
                payload?.notes?.estimated_cost ?? t('dashboard.empty.estimated_cost_message')
              }
            />
          </Card>

          <Card
            subtitle={t('dashboard.section.models')}
            title={t('dashboard.chart.model_usage')}
            rightSlot={<Badge variant="info">{t('dashboard.badge.tracked_usage')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.chart.model_usage_subtitle')}
            </div>
            <MultiLineChart
              series={modelUsageSeries}
              emptyTitle={t('dashboard.empty.model_usage_title')}
              emptyMessage={
                payload?.notes?.model_usage ?? t('dashboard.empty.model_usage_message')
              }
            />
          </Card>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card
            subtitle={t('dashboard.section.operations')}
            title={t('dashboard.operations.worker_status')}
            rightSlot={
              <Badge variant={statusVariant(worker?.state)}>
                {worker?.state ?? t('dashboard.placeholder.unknown')}
              </Badge>
            }
            interactive={false}
          >
            <div className="grid gap-3 text-sm text-slate-700">
              <StatusRow
                label={t('dashboard.operations.worker_state')}
                value={
                  worker?.running
                    ? t('dashboard.operations.processing_available')
                    : t('dashboard.operations.not_processing')
                }
              />
              <StatusRow
                label={t('dashboard.operations.telegram_mode')}
                value={tgMode ? String(tgMode) : t('dashboard.operations.not_configured')}
              />
              <StatusRow
                label={t('dashboard.operations.active_enabled_workers')}
                value={`${activeWorkers} / ${fmtNumber(enabledWorkers)}`}
              />
              <StatusRow
                label={t('dashboard.operations.last_poll')}
                value={fmtTimestamp(worker?.last_poll) || t('dashboard.placeholder.no_activity_yet')}
              />
            </div>
          </Card>

          <Card
            subtitle={t('dashboard.section.health')}
            title={t('dashboard.operations.operational_health')}
            rightSlot={
              <Badge variant={op?.error_count_24h ? 'warning' : 'success'}>
                {t('dashboard.badge.last_24_hours')}
              </Badge>
            }
            interactive={false}
          >
            <div className="grid gap-3 text-sm text-slate-700">
              <StatusRow
                label={t('dashboard.operations.error_count')}
                value={fmtNumber(op?.error_count_24h)}
              />
              <StatusRow
                label={t('dashboard.operations.error_rate')}
                value={fmtPercent(op?.error_rate_24h)}
                valueClassName={
                  op?.error_count_24h ? 'text-amber-700' : 'text-emerald-700'
                }
              />
              <StatusRow
                label={t('dashboard.operations.last_activity')}
                value={fmtTimestamp(op?.last_activity_ts) || t('dashboard.placeholder.no_activity_yet')}
              />
              <StatusRow
                label={t('dashboard.operations.last_error')}
                value={
                  worker?.last_error
                    ? t('dashboard.operations.available_in_logs')
                    : t('dashboard.operations.no_recent_errors')
                }
              />
            </div>
          </Card>

          <Card
            subtitle={t('dashboard.section.business')}
            title={t('dashboard.operations.revenue_readiness')}
            rightSlot={<Badge variant="neutral">{t('dashboard.badge.future_ready')}</Badge>}
            interactive={false}
          >
            <div className="grid gap-3 text-sm text-slate-700">
              <StatusRow
                label={t('dashboard.kpi.estimated_cost')}
                value={
                  summary?.estimated_cost_usd == null
                    ? t('dashboard.placeholder.not_available')
                    : fmtCurrency(summary.estimated_cost_usd)
                }
              />
              <StatusRow
                label={t('dashboard.kpi.paid_members')}
                value={
                  summary?.paid_members == null
                    ? t('dashboard.placeholder.pending_billing')
                    : fmtNumber(summary.paid_members)
                }
              />
              <StatusRow
                label={t('dashboard.operations.membership_status')}
                value={payload?.membership?.note ?? t('dashboard.placeholder.not_available')}
              />
            </div>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card
            subtitle={t('dashboard.section.usage')}
            title={t('dashboard.users.title')}
            rightSlot={<Badge variant="info">{t('dashboard.badge.admin_only')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.users.subtitle')}
            </div>
            <div className="space-y-3">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {t('dashboard.users.by_cost')}
                </div>
                {topUsersByCost.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                    {t('dashboard.users.empty_cost')}
                  </div>
                ) : (
                  topUsersByCost.map((entry, index) => (
                    <TopUserItem
                      key={`cost-${entry.user_id}`}
                      user={entry}
                      rank={index + 1}
                      rankLabel={t('dashboard.users.user')}
                      userPrefix={t('dashboard.users.user')}
                      requestsLabel={t('dashboard.users.requests')}
                      tokensLabel={t('dashboard.users.tokens')}
                      viewLabel={t('dashboard.action.view')}
                    />
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {t('dashboard.users.by_tokens')}
                </div>
                {topUsersByTokens.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                    {t('dashboard.users.empty_tokens')}
                  </div>
                ) : (
                  topUsersByTokens.map((entry, index) => (
                    <TopUserItem
                      key={`tokens-${entry.user_id}`}
                      user={entry}
                      rank={index + 1}
                      rankLabel={t('dashboard.users.user')}
                      userPrefix={t('dashboard.users.user')}
                      requestsLabel={t('dashboard.users.requests')}
                      tokensLabel={t('dashboard.users.tokens')}
                      viewLabel={t('dashboard.action.view')}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card
            subtitle={t('dashboard.section.business')}
            title={t('dashboard.breakdown.title')}
            rightSlot={<Badge variant="info">{t('dashboard.badge.tracked_usage')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.breakdown.subtitle')}
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {t('dashboard.breakdown.by_model')}
                </div>
                {costByModel.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                    {t('dashboard.breakdown.empty_model')}
                  </div>
                ) : (
                  costByModel.map(item => (
                    <BreakdownItem
                      key={`model-${item.label}`}
                      item={item}
                      totalCost={totalBreakdownCost}
                      tokensLabel={t('dashboard.users.tokens')}
                      requestsLabel={t('dashboard.users.requests')}
                      noCostLabel={t('dashboard.breakdown.no_cost')}
                      costShareSuffix={t('dashboard.breakdown.cost_share_suffix')}
                    />
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  {t('dashboard.breakdown.by_purpose')}
                </div>
                {costByPurpose.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                    {t('dashboard.breakdown.empty_purpose')}
                  </div>
                ) : (
                  costByPurpose.map(item => (
                    <BreakdownItem
                      key={`purpose-${item.label}`}
                      item={item}
                      totalCost={totalBreakdownCost}
                      tokensLabel={t('dashboard.users.tokens')}
                      requestsLabel={t('dashboard.users.requests')}
                      noCostLabel={t('dashboard.breakdown.no_cost')}
                      costShareSuffix={t('dashboard.breakdown.cost_share_suffix')}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-8">
          <Card
            subtitle={t('dashboard.section.operations')}
            title={t('dashboard.activity.title')}
            rightSlot={<Badge variant="neutral">{t('dashboard.activity.badge')}</Badge>}
            interactive={false}
          >
            <div className="mb-4 text-sm text-slate-500">
              {t('dashboard.activity.subtitle')}
            </div>
            <div className="space-y-3">
              {recentLogs.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-slate-200/80 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
                  {t('dashboard.activity.empty')}
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
