import React from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Modal } from '../../../components/common/Modal'
import { Card } from '../../../components/common/Card'
import { Badge } from '../../../components/common/Badge'
import { Button } from '../../../components/common/Button'
import { useI18n } from '../../../i18n/useI18n'
import type {
  EmailCategory,
  EmailPriority,
  EmailSuggestedAction,
  ProcessedEmailDetail,
  ProcessedEmailExecutedAction,
  ProcessedEmailReplyOption,
  ReplyDraftTone,
} from '../../../types'
import { getProcessedEmailDetail } from '../api'
import {
  formatProcessedAt,
  getBadgeVariantForAction,
  getBadgeVariantForCategory,
  getBadgeVariantForPriority,
  getBadgeVariantForStatus,
} from '../utils'

const DRAFT_TONES: ReplyDraftTone[] = ['formal', 'friendly', 'concise']

function parseMatchRuleExpression(rule: string): { category?: string; priority?: string } {
  const normalized = String(rule || '').toLowerCase()
  const categoryMatch = normalized.match(/\bcategory\s*=\s*([a-z_]+)/i)
  const priorityMatch = normalized.match(/\bpriority\s*=\s*([a-z_]+)/i)

  return {
    category: categoryMatch?.[1],
    priority: priorityMatch?.[1],
  }
}

function formatMatchedRuleSentence(rule: string, t: (key: string) => string): string {
  const parsed = parseMatchRuleExpression(rule)
  const category = parsed.category as EmailCategory | undefined
  const priority = parsed.priority as EmailPriority | undefined

  const categoryLabel = category ? t(`inbox.category.${category}`) : null
  const priorityLabel = priority ? t(`inbox.priority.${priority}`) : null

  if (categoryLabel && priorityLabel) {
    return t('inbox.detail.rule_match.category_priority')
      .replace('{category}', categoryLabel)
      .replace('{priority}', priorityLabel)
  }

  if (categoryLabel) {
    return t('inbox.detail.rule_match.category_only').replace('{category}', categoryLabel)
  }

  if (priorityLabel) {
    return t('inbox.detail.rule_match.priority_only').replace('{priority}', priorityLabel)
  }

  return t('inbox.detail.rule_match.all')
}

function formatExecutedActionLabel(action: string, t: (key: string) => string): string {
  const normalized = String(action || '').trim().toLowerCase()
  if (normalized === 'notify') return t('inbox.detail.exec_action.notify')
  if (normalized === 'mark_read') return t('inbox.detail.exec_action.mark_read')
  return action
}

function formatExecutedActionOutcome(action: ProcessedEmailExecutedAction, actionLabel: string, t: (key: string) => string) {
  const normalized = String(action.action || '').trim().toLowerCase()

  if (normalized === 'notify') {
    return action.success ? t('inbox.detail.exec_outcome.notify.success') : t('inbox.detail.exec_outcome.notify.failed')
  }
  if (normalized === 'mark_read') {
    return action.success
      ? t('inbox.detail.exec_outcome.mark_read.success')
      : t('inbox.detail.exec_outcome.mark_read.failed')
  }

  const base = action.success
    ? t('inbox.detail.exec_outcome.unknown.success').replace('{action}', actionLabel)
    : t('inbox.detail.exec_outcome.unknown.failed').replace('{action}', actionLabel)

  if (!action.success && action.optional) {
    return base + t('inbox.detail.exec_outcome.optional_suffix')
  }

  return base
}

function MetadataList({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata || {})

  if (entries.length === 0) return null

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-2xl border border-white/70 bg-white/60 px-3.5 py-3 ring-1 ring-black/[0.03]"
        >
          <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{key}</dt>
          <dd className="mt-1 break-words text-sm leading-6 text-slate-700">
            {typeof value === 'string' ? value : JSON.stringify(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function DraftCard({ draft }: { draft: ProcessedEmailReplyOption }) {
  const { t } = useI18n()
  const draftTitle = draft.label || t(`inbox.detail.reply_tone.${draft.tone}`)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.content)
      toast.success(t('inbox.detail.draft_copied').replace('{label}', draftTitle))
    } catch {
      toast.error(t('inbox.detail.draft_copy_failed'))
    }
  }

  return (
    <Card
      interactive={false}
      title={draftTitle}
      subtitle={t(`inbox.detail.reply_tone.${draft.tone}`)}
      rightSlot={
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {t('inbox.detail.btn_copy')}
        </Button>
      }
    >
      <div className="whitespace-pre-wrap rounded-[22px] border border-white/70 bg-white/55 p-4 text-sm leading-7 text-slate-700 ring-1 ring-black/[0.03]">
        {draft.content}
      </div>
    </Card>
  )
}

function AnalysisSection({ detail }: { detail: ProcessedEmailDetail }) {
  const { t } = useI18n()
  const analysis = detail.analysis || {}
  const category = analysis.category as EmailCategory | undefined
  const priority = analysis.priority as EmailPriority | undefined
  const action = analysis.action as EmailSuggestedAction | undefined

  return (
    <Card
      interactive={false}
      title={t('inbox.detail.analysis_title')}
      subtitle={t('inbox.detail.analysis_subtitle')}
    >
      <div className="space-y-4">
        <p className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 text-sm leading-7 text-slate-700 ring-1 ring-black/[0.03]">
          {analysis.summary || detail.summary || t('inbox.no_summary')}
        </p>

        <div className="flex flex-wrap gap-2">
          {category ? (
            <Badge variant={getBadgeVariantForCategory(category)}>{t(`inbox.category.${category}`)}</Badge>
          ) : null}
          {priority ? (
            <Badge variant={getBadgeVariantForPriority(priority)}>{t(`inbox.priority.${priority}`)}</Badge>
          ) : null}
          {action ? (
            <Badge variant={getBadgeVariantForAction(action)}>{t(`inbox.action.${action}`)}</Badge>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.detail.reason')}</div>
            <div className="mt-2 text-sm leading-7 text-slate-700">
              {analysis.reason || t('inbox.detail.empty_reason')}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.detail.deadline')}</div>
            <div className="mt-2 text-sm leading-7 text-slate-700">
              {analysis.deadline || t('inbox.detail.no_deadline')}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ExecutedActionItem({ action }: { action: ProcessedEmailExecutedAction }) {
  const { t } = useI18n()
  const actionLabel = formatExecutedActionLabel(action.action, t)
  const variant = action.success ? 'success' : action.optional ? 'warning' : 'error'
  const statusLabel = action.success
    ? t('inbox.detail.action_result.success')
    : action.optional
      ? t('inbox.detail.action_result.optional_failed')
      : t('inbox.detail.action_result.failed')
  const outcome = formatExecutedActionOutcome(action, actionLabel, t)

  return (
    <div className="rounded-[22px] border border-white/70 bg-white/55 p-4 ring-1 ring-black/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{actionLabel}</Badge>
        <Badge variant={variant}>{statusLabel}</Badge>
        {action.optional ? <Badge variant="info">{t('inbox.detail.optional_action')}</Badge> : null}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm leading-7 text-slate-700">{outcome}</p>
        {action.message ? (
          <p className="text-xs leading-6 text-slate-500">{action.message}</p>
        ) : (
          <p className="text-xs leading-6 text-slate-500">{t('inbox.detail.no_action_message')}</p>
        )}
      </div>

      <div className="mt-3">
        <MetadataList metadata={action.metadata} />
      </div>
    </div>
  )
}

export const ProcessedEmailDetailModal: React.FC<{
  emailId: number | null
  isOpen: boolean
  onClose: () => void
}> = ({ emailId, isOpen, onClose }) => {
  const { t, lang } = useI18n()
  const locale = lang === 'zh' ? 'zh-CN' : 'en-AU'

  const query = useQuery({
    queryKey: ['processed-email-detail', emailId],
    queryFn: () => getProcessedEmailDetail(emailId as number),
    enabled: isOpen && emailId != null,
  })

  const detail = query.data
  const drafts = detail?.reply_drafts?.options || []
  const draftsByTone = DRAFT_TONES.map((tone) => drafts.find((item) => item.tone === tone)).filter(
    (item): item is ProcessedEmailReplyOption => Boolean(item),
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('inbox.detail.title')} size="xl">
      {query.isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-32 animate-pulse rounded-[24px] border border-white/70 bg-white/55"
            />
          ))}
        </div>
      ) : query.isError ? (
        <Card
          interactive={false}
          title={t('inbox.detail.error_title')}
          subtitle={t('inbox.detail.error_subtitle')}
        >
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-slate-600">{t('inbox.detail.error_body')}</p>
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t('inbox.retry')}
            </Button>
          </div>
        </Card>
      ) : !detail ? (
        <Card
          interactive={false}
          title={t('inbox.detail.empty_title')}
          subtitle={t('inbox.detail.empty_subtitle')}
        >
          <p className="text-sm text-slate-600">{t('inbox.detail.empty_body')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card
            interactive={false}
            title={detail.subject || t('inbox.no_subject')}
            subtitle={detail.sender || t('inbox.unknown_sender')}
            rightSlot={
              <Badge variant={getBadgeVariantForStatus(detail.processing_status)}>
                {t(`inbox.status.${detail.processing_status}`)}
              </Badge>
            }
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.meta.sender')}</div>
                <div className="mt-2 text-sm text-slate-700">{detail.sender || t('inbox.unknown_sender')}</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.meta.processed_at')}</div>
                <div className="mt-2 text-sm text-slate-700">{formatProcessedAt(detail.processed_at, locale)}</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.detail.processing_status')}</div>
                <div className="mt-2 text-sm text-slate-700">{t(`inbox.status.${detail.processing_status}`)}</div>
              </div>
            </div>
          </Card>

          <AnalysisSection detail={detail} />

          <Card
            interactive={false}
            title={t('inbox.detail.rules_title')}
            subtitle={t('inbox.detail.rules_subtitle')}
          >
            {detail.matched_rules.length === 0 ? (
              <p className="text-sm text-slate-600">{t('inbox.detail.no_rules')}</p>
            ) : (
              <div className="space-y-3">
                {detail.matched_rules.map((rule, index) => (
                  <div
                    key={`${rule.rule}-${index}`}
                    className="rounded-[22px] border border-white/70 bg-white/55 p-4 ring-1 ring-black/[0.03]"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="neutral">{formatMatchedRuleSentence(rule.rule, t)}</Badge>
                      {rule.action ? <Badge variant="info">{formatExecutedActionLabel(rule.action, t)}</Badge> : null}
                    </div>
                    <div className="mt-3">
                      {rule.detail ? (
                        <p className="text-sm leading-7 text-slate-700">{rule.detail}</p>
                      ) : (
                        <p className="text-sm leading-7 text-slate-700">{t('inbox.detail.no_rule_detail')}</p>
                      )}
                    </div>
                    <div className="mt-3">
                      <MetadataList metadata={rule.metadata} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            interactive={false}
            title={t('inbox.detail.executed_actions_title')}
            subtitle={t('inbox.detail.executed_actions_subtitle')}
          >
            {detail.executed_actions.length === 0 ? (
              <p className="text-sm text-slate-600">{t('inbox.detail.no_actions')}</p>
            ) : (
              <div className="space-y-3">
                {detail.executed_actions.map((action, index) => (
                  <ExecutedActionItem key={`${action.action}-${index}`} action={action} />
                ))}
              </div>
            )}
          </Card>

          <Card
            interactive={false}
            title={t('inbox.detail.reply_drafts_title')}
            subtitle={t('inbox.detail.reply_drafts_subtitle')}
          >
            {draftsByTone.length === 0 ? (
              <p className="text-sm text-slate-600">{t('inbox.detail.no_reply_drafts')}</p>
            ) : (
              <div className="space-y-3">
                {draftsByTone.map((draft) => (
                  <DraftCard key={draft.tone} draft={draft} />
                ))}
              </div>
            )}
          </Card>

          <Card
            interactive={false}
            title={t('inbox.detail.original_email_title')}
            subtitle={t('inbox.detail.original_email_subtitle')}
          >
            <div className="whitespace-pre-wrap rounded-[22px] border border-white/70 bg-white/55 p-4 text-sm leading-7 text-slate-700 ring-1 ring-black/[0.03]">
              {detail.original_email_content || t('inbox.detail.no_original_content')}
            </div>
          </Card>
        </div>
      )}
    </Modal>
  )
}
