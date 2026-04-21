import React from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Surface } from '../../../components/common/Surface'
import { Card } from '../../../components/common/Card'
import { Badge } from '../../../components/common/Badge'
import { Button } from '../../../components/common/Button'
import { Select } from '../../../components/common/Select'
import { Modal } from '../../../components/common/Modal'
import { useI18n } from '../../../i18n/useI18n'
import { getMe } from '../../auth/api'
import {
  createEmailAutomationRule,
  deleteEmailAutomationRule,
  listEmailAutomationRules,
  updateEmailAutomationRule,
} from '../api'
import type {
  EmailAutomationRule,
  EmailAutomationRuleAction,
  EmailCategory,
  EmailPriority,
} from '../../../types'

const CATEGORY_OPTIONS: Array<{ labelKey: string; value: EmailCategory }> = [
  { labelKey: 'inbox.category.job', value: 'job' },
  { labelKey: 'inbox.category.finance', value: 'finance' },
  { labelKey: 'inbox.category.social', value: 'social' },
  { labelKey: 'inbox.category.spam', value: 'spam' },
  { labelKey: 'inbox.category.other', value: 'other' },
]

const PRIORITY_OPTIONS: Array<{ labelKey: string; value: EmailPriority }> = [
  { labelKey: 'opt.priority.high', value: 'high' },
  { labelKey: 'opt.priority.medium', value: 'medium' },
  { labelKey: 'opt.priority.low', value: 'low' },
]

const ACTION_OPTIONS: Array<{ labelKey: string; value: EmailAutomationRuleAction }> = [
  { labelKey: 'rules.action.notify', value: 'notify' },
  { labelKey: 'rules.action.mark_read', value: 'mark_read' },
]

function formatDate(value: string, locale: string) {
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

function getApiErrorMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null
  const data = err.response?.data as unknown
  if (!data || typeof data !== 'object') return null
  const maybeDetail = (data as { detail?: unknown }).detail
  const maybeMessage = (data as { message?: unknown }).message
  if (typeof maybeDetail === 'string' && maybeDetail.trim()) return maybeDetail
  if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage
  return null
}

function getRuleSummary(rule: EmailAutomationRule, t: (key: string) => string) {
  const category = rule.category ? t(`inbox.category.${rule.category}`) : null
  const priority = rule.priority ? t(`inbox.priority.${rule.priority}`) : null

  if (category && priority) {
    return t('rules.match.category_priority')
      .replace('{category}', category)
      .replace('{priority}', priority)
  }

  if (category) {
    return t('rules.match.category_only').replace('{category}', category)
  }

  if (priority) {
    return t('rules.match.priority_only').replace('{priority}', priority)
  }

  return t('rules.match.all')
}

type RuleEditorState = {
  id: number
  category: EmailCategory | ''
  priority: EmailPriority | ''
  action: EmailAutomationRuleAction
  enabled: 'true' | 'false'
}

export const AutomationRulesPage: React.FC = () => {
  const { t, lang } = useI18n()
  const locale = lang === 'zh' ? 'zh-CN' : 'en-AU'
  const qc = useQueryClient()

  const [category, setCategory] = React.useState<EmailCategory | ''>('')
  const [priority, setPriority] = React.useState<EmailPriority | ''>('')
  const [action, setAction] = React.useState<EmailAutomationRuleAction>('notify')
  const [enabled, setEnabled] = React.useState<'true' | 'false'>('true')
  const [editingRule, setEditingRule] = React.useState<RuleEditorState | null>(null)

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: getMe,
    staleTime: 60_000,
  })

  const userId = meQuery.data?.id

  const rulesQuery = useQuery({
    queryKey: ['email-automation-rules', userId],
    queryFn: () => listEmailAutomationRules(userId as number),
    enabled: Boolean(userId),
  })

  const invalidateRules = () => {
    qc.invalidateQueries({ queryKey: ['email-automation-rules', userId] })
  }

  const createRuleMutation = useMutation({
    mutationFn: () =>
      createEmailAutomationRule(userId as number, {
        category: category || null,
        priority: priority || null,
        action,
        enabled: enabled === 'true',
      }),
    onSuccess: () => {
      invalidateRules()
      setCategory('')
      setPriority('')
      setAction('notify')
      setEnabled('true')
      toast.success(t('rules.created'))
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) ?? t('rules.create_failed'))
    },
  })

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, enabledValue }: { ruleId: number; enabledValue: boolean }) =>
      updateEmailAutomationRule(userId as number, ruleId, { enabled: enabledValue }),
    onSuccess: (_data, variables) => {
      invalidateRules()
      toast.success(variables.enabledValue ? t('rules.enabled_success') : t('rules.disabled_success'))
    },
    onError: (err, variables) => {
      const fallback = variables.enabledValue ? t('rules.enable_failed') : t('rules.disable_failed')
      toast.error(getApiErrorMessage(err) ?? fallback)
    },
  })

  const editRuleMutation = useMutation({
    mutationFn: (payload: RuleEditorState) =>
      updateEmailAutomationRule(userId as number, payload.id, {
        category: payload.category || null,
        priority: payload.priority || null,
        action: payload.action,
        enabled: payload.enabled === 'true',
      }),
    onSuccess: () => {
      invalidateRules()
      setEditingRule(null)
      toast.success(t('rules.updated'))
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) ?? t('rules.update_failed'))
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: number) => deleteEmailAutomationRule(userId as number, ruleId),
    onSuccess: () => {
      invalidateRules()
      toast.success(t('rules.deleted'))
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) ?? t('rules.delete_failed'))
    },
  })

  const isLoading = meQuery.isLoading || (Boolean(userId) && rulesQuery.isLoading)
  const isError = meQuery.isError || rulesQuery.isError
  const rules = rulesQuery.data || []

  return (
    <div className="min-h-screen w-full bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,252,255,0.96)_52%,rgba(246,249,253,0.95)_100%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(217,235,255,0.45),transparent_70%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-5">
        <Surface
          title={t('rules.title')}
          eyebrow={t('nav.automation_rules')}
          badge={rulesQuery.data ? `${rules.length} ${t('rules.count')}` : t('rules.subtitle')}
        >
          <div className="grid gap-3 md:grid-cols-5">
            <Select
              label={t('rules.form.category')}
              value={category}
              onChange={(e) => setCategory(e.target.value as EmailCategory | '')}
              options={[
                { label: t('rules.form.any'), value: '' },
                ...CATEGORY_OPTIONS.map((option) => ({
                  label: t(option.labelKey),
                  value: option.value,
                })),
              ]}
            />
            <Select
              label={t('rules.form.priority')}
              value={priority}
              onChange={(e) => setPriority(e.target.value as EmailPriority | '')}
              options={[
                { label: t('rules.form.any'), value: '' },
                ...PRIORITY_OPTIONS.map((option) => ({
                  label: t(option.labelKey),
                  value: option.value,
                })),
              ]}
            />
            <Select
              label={t('rules.form.action')}
              value={action}
              onChange={(e) => setAction(e.target.value as EmailAutomationRuleAction)}
              options={ACTION_OPTIONS.map((option) => ({
                label: t(option.labelKey),
                value: option.value,
              }))}
            />
            <Select
              label={t('rules.form.enabled')}
              value={enabled}
              onChange={(e) => setEnabled(e.target.value as 'true' | 'false')}
              options={[
                { label: t('rules.enabled'), value: 'true' },
                { label: t('rules.disabled'), value: 'false' },
              ]}
            />
            <div className="flex items-end">
              <Button
                className="w-full"
                loading={createRuleMutation.isPending}
                disabled={!userId}
                onClick={() => createRuleMutation.mutate()}
              >
                {t('rules.create')}
              </Button>
            </div>
          </div>
        </Surface>

        {isLoading ? (
          <Card interactive={false} title={t('rules.loading_title')} subtitle={t('rules.loading_subtitle')}>
            <div className="space-y-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="h-28 animate-pulse rounded-[22px] border border-white/70 bg-white/55"
                />
              ))}
            </div>
          </Card>
        ) : isError ? (
          <Card interactive={false} title={t('rules.error_title')} subtitle={t('rules.error_subtitle')}>
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-slate-600">{t('rules.error_body')}</p>
              <Button variant="secondary" onClick={() => { meQuery.refetch(); rulesQuery.refetch() }}>
                {t('rules.retry')}
              </Button>
            </div>
          </Card>
        ) : rules.length === 0 ? (
          <Card interactive={false} title={t('rules.empty_title')} subtitle={t('rules.empty_subtitle')}>
            <p className="text-sm text-slate-600">{t('rules.empty_body')}</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => {
              const togglePending =
                toggleRuleMutation.isPending && toggleRuleMutation.variables?.ruleId === rule.id
              const deletePending =
                deleteRuleMutation.isPending && deleteRuleMutation.variables === rule.id

              return (
                <Card
                  key={rule.id}
                  interactive={false}
                  title={getRuleSummary(rule, t)}
                  subtitle={t('rules.rule_title').replace('{id}', String(rule.id))}
                  rightSlot={
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={rule.enabled ? 'success' : 'neutral'}>
                        {rule.enabled ? t('rules.enabled') : t('rules.disabled')}
                      </Badge>
                      <Badge variant={rule.action === 'notify' ? 'warning' : 'info'}>
                        {t(`rules.action.${rule.action}`)}
                      </Badge>
                    </div>
                  }
                  footer={
                    <>
                      <Button
                        variant="ghost"
                        disabled={!userId || togglePending || deletePending || editRuleMutation.isPending}
                        onClick={() =>
                          setEditingRule({
                            id: rule.id,
                            category: rule.category || '',
                            priority: rule.priority || '',
                            action: rule.action,
                            enabled: rule.enabled ? 'true' : 'false',
                          })
                        }
                      >
                        {t('rules.edit')}
                      </Button>
                      <Button
                        variant="secondary"
                        loading={togglePending}
                        disabled={!userId || deletePending || editRuleMutation.isPending}
                        onClick={() =>
                          toggleRuleMutation.mutate({
                            ruleId: rule.id,
                            enabledValue: !rule.enabled,
                          })
                        }
                      >
                        {rule.enabled ? t('rules.disable') : t('rules.enable')}
                      </Button>
                      <Button
                        variant="ghost"
                        loading={deletePending}
                        disabled={!userId || togglePending || editRuleMutation.isPending}
                        onClick={() => deleteRuleMutation.mutate(rule.id)}
                      >
                        {t('rules.delete')}
                      </Button>
                    </>
                  }
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {rule.category ? (
                        <Badge variant="info">{t(`inbox.category.${rule.category}`)}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('rules.form.any_category')}</Badge>
                      )}
                      {rule.priority ? (
                        <Badge variant="warning">{t(`inbox.priority.${rule.priority}`)}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('rules.form.any_priority')}</Badge>
                      )}
                    </div>

                    <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-3 ring-1 ring-black/[0.03]">
                        <div className="uppercase tracking-[0.16em] text-[10px]">{t('rules.created_at')}</div>
                        <div className="mt-1 text-sm text-slate-700">{formatDate(rule.created_at, locale)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-3 ring-1 ring-black/[0.03]">
                        <div className="uppercase tracking-[0.16em] text-[10px]">{t('rules.updated_at')}</div>
                        <div className="mt-1 text-sm text-slate-700">{formatDate(rule.updated_at, locale)}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={editingRule != null}
        onClose={() => {
          if (!editRuleMutation.isPending) {
            setEditingRule(null)
          }
        }}
        title={t('rules.edit_title')}
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={editRuleMutation.isPending}
              onClick={() => setEditingRule(null)}
            >
              {t('btn.cancel')}
            </Button>
            <Button
              loading={editRuleMutation.isPending}
              onClick={() => {
                if (editingRule) {
                  editRuleMutation.mutate(editingRule)
                }
              }}
            >
              {t('rules.save')}
            </Button>
          </>
        }
      >
        {editingRule ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('rules.form.category')}
              value={editingRule.category}
              onChange={(e) =>
                setEditingRule((current) =>
                  current ? { ...current, category: e.target.value as EmailCategory | '' } : current,
                )
              }
              options={[
                { label: t('rules.form.any'), value: '' },
                ...CATEGORY_OPTIONS.map((option) => ({
                  label: t(option.labelKey),
                  value: option.value,
                })),
              ]}
            />
            <Select
              label={t('rules.form.priority')}
              value={editingRule.priority}
              onChange={(e) =>
                setEditingRule((current) =>
                  current ? { ...current, priority: e.target.value as EmailPriority | '' } : current,
                )
              }
              options={[
                { label: t('rules.form.any'), value: '' },
                ...PRIORITY_OPTIONS.map((option) => ({
                  label: t(option.labelKey),
                  value: option.value,
                })),
              ]}
            />
            <Select
              label={t('rules.form.action')}
              value={editingRule.action}
              onChange={(e) =>
                setEditingRule((current) =>
                  current ? { ...current, action: e.target.value as EmailAutomationRuleAction } : current,
                )
              }
              options={ACTION_OPTIONS.map((option) => ({
                label: t(option.labelKey),
                value: option.value,
              }))}
            />
            <Select
              label={t('rules.form.enabled')}
              value={editingRule.enabled}
              onChange={(e) =>
                setEditingRule((current) =>
                  current ? { ...current, enabled: e.target.value as 'true' | 'false' } : current,
                )
              }
              options={[
                { label: t('rules.enabled'), value: 'true' },
                { label: t('rules.disabled'), value: 'false' },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
