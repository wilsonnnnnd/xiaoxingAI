import React, { useMemo, useState } from 'react'
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

const safeT = (t: (key: string) => string, key: string, fallback: string) => {
  const value = t(key)
  if (!value || value === key) return fallback
  return value
}

const uiText = (lang: string, en: string, zh: string) => (lang === 'zh' ? zh : en)

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

const isLikelyTechnical = (text: string) => {
  const s = String(text || '').trim()
  if (!s) return false
  if (s.includes('email_records')) return true
  if (s.includes('priority=') || s.includes('min_priority=')) return true
  if (/\b[a-z_]+=[^\s]+\b/i.test(s)) return true
  return false
}

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
          <dd className="mt-1 break-words [overflow-wrap:anywhere] text-sm leading-6 text-slate-700">
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
  const { t, lang } = useI18n()
  const analysis = detail.analysis || {}
  const category = analysis.category as EmailCategory | undefined
  const priority = analysis.priority as EmailPriority | undefined
  const action = analysis.action as EmailSuggestedAction | undefined
  const unknown = uiText(lang, 'Unknown', '未知')
  const categoryLabel = category ? safeT(t, `inbox.category.${category}`, String(category)) : null
  const priorityLabel = priority ? safeT(t, `inbox.priority.${priority}`, String(priority)) : null
  const actionLabel = action ? safeT(t, `inbox.action.${action}`, String(action)) : null

  return (
    <Card
      interactive={false}
      title={t('inbox.detail.analysis_title')}
      subtitle={t('inbox.detail.analysis_subtitle')}
    >
      <div className="space-y-4">
        <p className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 text-[13px] leading-7 text-slate-600 ring-1 ring-black/[0.03] min-w-0 overflow-hidden break-words [overflow-wrap:anywhere] line-clamp-2 sm:line-clamp-none">
          {analysis.summary || detail.summary || t('inbox.no_summary')}
        </p>

        <div className="flex flex-wrap gap-2">
          {category && categoryLabel ? <Badge variant={getBadgeVariantForCategory(category)}>{categoryLabel}</Badge> : null}
          {priority && priorityLabel ? <Badge variant={getBadgeVariantForPriority(priority)}>{priorityLabel}</Badge> : null}
          {action && actionLabel ? <Badge variant={getBadgeVariantForAction(action)}>{actionLabel}</Badge> : null}
          {!categoryLabel && !priorityLabel && !actionLabel ? (
            <Badge variant="neutral">{unknown}</Badge>
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
  const { t, lang } = useI18n()
  const actionLabel = formatExecutedActionLabel(action.action, t)
  const variant = action.success ? 'success' : action.optional ? 'warning' : 'error'
  const statusLabel = action.success
    ? t('inbox.detail.action_result.success')
    : action.optional
      ? t('inbox.detail.action_result.optional_failed')
      : t('inbox.detail.action_result.failed')
  const outcome = formatExecutedActionOutcome(action, actionLabel, t)
  const rawMessage = String(action.message || '').trim()
  const hasMetadata = Object.keys(action.metadata || {}).length > 0
  const technicalMessage = rawMessage && isLikelyTechnical(rawMessage)
  const userMessage = rawMessage && !technicalMessage ? rawMessage : ''
  const detailsLabel = uiText(lang, 'Technical details', '技术细节')
  const hintLabel = uiText(lang, 'Details available', '可查看详情')

  return (
    <div className="rounded-[22px] border border-white/70 bg-white/55 p-4 ring-1 ring-black/[0.03]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{actionLabel}</Badge>
        <Badge variant={variant}>{statusLabel}</Badge>
        {action.optional ? <Badge variant="info">{t('inbox.detail.optional_action')}</Badge> : null}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm leading-7 text-slate-700">{outcome}</p>
        {userMessage ? <p className="text-xs leading-6 text-slate-500 break-words [overflow-wrap:anywhere]">{userMessage}</p> : null}
        {!userMessage && (technicalMessage || hasMetadata) ? (
          <p className="text-xs leading-6 text-slate-500">{hintLabel}</p>
        ) : null}
        {!userMessage && !technicalMessage && !hasMetadata ? (
          <p className="text-xs leading-6 text-slate-500">{t('inbox.detail.no_action_message')}</p>
        ) : null}
      </div>

      {technicalMessage || hasMetadata ? (
        <details className="mt-3 rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 ring-1 ring-black/[0.03]">
          <summary className="cursor-pointer select-none text-xs font-medium text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/20">
            {detailsLabel}
          </summary>
          <div className="mt-3 space-y-3">
            {technicalMessage ? (
              <div className="rounded-2xl border border-white/70 bg-white/60 px-3.5 py-3 ring-1 ring-black/[0.03]">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">message</div>
                <div className="mt-1 text-sm leading-6 text-slate-700 break-words [overflow-wrap:anywhere]">{rawMessage}</div>
              </div>
            ) : null}
            {hasMetadata ? <MetadataList metadata={action.metadata} /> : null}
          </div>
        </details>
      ) : null}
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
  const [senderExpanded, setSenderExpanded] = useState(false)
  const [originalStep, setOriginalStep] = useState(0)
  const unknown = uiText(lang, 'Unknown', '未知')
  const showMoreLabel = uiText(lang, 'Show more', '展开更多')
  const showLessLabel = uiText(lang, 'Show less', '收起')
  const originalMaxH = originalStep === 0 ? 'max-h-56' : originalStep === 1 ? 'max-h-[28rem]' : 'max-h-none'
  const originalHasMore = originalStep < 2

  const query = useQuery({
    queryKey: ['processed-email-detail', emailId],
    queryFn: () => getProcessedEmailDetail(emailId as number),
    enabled: isOpen && emailId != null,
  })

  const detail = query.data
  const sender = useMemo(() => shortSender(detail?.sender || ''), [detail?.sender])
  const drafts = detail?.reply_drafts?.options || []
  const draftsByTone = DRAFT_TONES.map((tone) => drafts.find((item) => item.tone === tone)).filter(
    (item): item is ProcessedEmailReplyOption => Boolean(item),
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('inbox.detail.title')} size="3xl">
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
        <div className="mx-auto w-full max-w-5xl space-y-5 overflow-x-hidden">
          <Card
            interactive={false}
            title={detail.subject || t('inbox.no_subject')}
            subtitle={(sender.short || detail.sender) || t('inbox.unknown_sender')}
            rightSlot={
              <div className="flex items-center gap-2">
                {detail.has_attachments ? (
                  <Badge variant="info">
                    {t('inbox.attachments.badge').replace('{count}', String(detail.attachment_count || 0))}
                  </Badge>
                ) : null}
                <Badge variant={getBadgeVariantForStatus(detail.processing_status)}>
                  {detail.processing_status
                    ? safeT(t, `inbox.status.${detail.processing_status}`, detail.processing_status)
                    : unknown}
                </Badge>
              </div>
            }
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.meta.sender')}</div>
                <button
                  type="button"
                  onClick={() => setSenderExpanded((v) => !v)}
                  className="mt-2 block w-full min-w-0 text-left text-sm text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/20"
                  title={sender.full || detail.sender}
                  aria-label={sender.full || detail.sender || t('inbox.unknown_sender')}
                >
                  {senderExpanded ? (
                    <span className="block break-words [overflow-wrap:anywhere]">{sender.full || detail.sender}</span>
                  ) : (
                    <span className="block truncate">{sender.short || detail.sender || t('inbox.unknown_sender')}</span>
                  )}
                </button>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.meta.processed_at')}</div>
                <div className="mt-2 text-sm text-slate-700">{formatProcessedAt(detail.processed_at, locale)}</div>
              </div>
              <div className="rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{t('inbox.detail.processing_status')}</div>
                <div className="mt-2 text-sm text-slate-700">
                  {detail.processing_status
                    ? safeT(t, `inbox.status.${detail.processing_status}`, detail.processing_status)
                    : unknown}
                </div>
              </div>
            </div>

            {detail.has_attachments ? (
              <div className="mt-3 rounded-[22px] border border-white/70 bg-white/55 px-4 py-4 ring-1 ring-black/[0.03]">
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {t('inbox.attachments.title')}
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-700">{t('inbox.attachments.notice')}</div>
                {detail.attachment_names && detail.attachment_names.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.attachment_names.map((name) => (
                      <Badge key={name} variant="neutral">
                        <span className="max-w-[240px] truncate sm:max-w-[360px]">{name}</span>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
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
                      <Badge variant="neutral">
                        <span className="break-words [overflow-wrap:anywhere]">{formatMatchedRuleSentence(rule.rule, t)}</span>
                      </Badge>
                      {rule.action ? <Badge variant="info">{formatExecutedActionLabel(rule.action, t)}</Badge> : null}
                    </div>
                    <div className="mt-3">
                      {rule.detail && !isLikelyTechnical(rule.detail) ? (
                        <p className="break-words [overflow-wrap:anywhere] text-sm leading-7 text-slate-700">{rule.detail}</p>
                      ) : (
                        <p className="text-sm leading-7 text-slate-700">{t('inbox.detail.no_rule_detail')}</p>
                      )}
                    </div>
                    {isLikelyTechnical(rule.detail) || Object.keys(rule.metadata || {}).length > 0 ? (
                      <details className="mt-3 rounded-[18px] border border-white/70 bg-white/55 px-4 py-3 ring-1 ring-black/[0.03]">
                        <summary className="cursor-pointer select-none text-xs font-medium text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/20">
                          {uiText(lang, 'Technical details', '技术细节')}
                        </summary>
                        <div className="mt-3 space-y-3">
                          {rule.detail && isLikelyTechnical(rule.detail) ? (
                            <div className="rounded-2xl border border-white/70 bg-white/60 px-3.5 py-3 ring-1 ring-black/[0.03]">
                              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">detail</div>
                              <div className="mt-1 text-sm leading-6 text-slate-700 break-words [overflow-wrap:anywhere]">
                                {rule.detail}
                              </div>
                            </div>
                          ) : null}
                          {Object.keys(rule.metadata || {}).length > 0 ? <MetadataList metadata={rule.metadata} /> : null}
                        </div>
                      </details>
                    ) : null}
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
            <div className="space-y-3">
              <div
                className={`whitespace-pre-wrap rounded-[22px] border border-white/70 bg-white/55 p-4 text-sm leading-7 text-slate-700 ring-1 ring-black/[0.03] break-words [overflow-wrap:anywhere] overflow-hidden ${originalMaxH}`}
              >
                {detail.original_email_content || t('inbox.detail.no_original_content')}
              </div>

              {detail.original_email_content ? (
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOriginalStep((v) => {
                        if (v >= 2) return 0
                        return v + 1
                      })
                    }}
                  >
                    {originalHasMore ? showMoreLabel : showLessLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </Modal>
  )
}
