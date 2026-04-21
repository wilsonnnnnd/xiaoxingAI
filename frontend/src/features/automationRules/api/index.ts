import { api } from '../../../api/client'
import type {
  EmailAutomationRule,
  EmailAutomationRuleAction,
  EmailCategory,
  EmailPriority,
} from '../../../types'

export interface CreateEmailAutomationRulePayload {
  category?: EmailCategory | null
  priority?: EmailPriority | null
  action: EmailAutomationRuleAction
  enabled: boolean
}

export interface UpdateEmailAutomationRulePayload {
  category?: EmailCategory | null
  priority?: EmailPriority | null
  action?: EmailAutomationRuleAction
  enabled?: boolean
}

export const listEmailAutomationRules = (userId: number) =>
  api
    .get<{ rules: EmailAutomationRule[] }>(`/users/${userId}/email-automation-rules`)
    .then((r) => r.data.rules)

export const createEmailAutomationRule = (
  userId: number,
  payload: CreateEmailAutomationRulePayload,
) =>
  api
    .post<EmailAutomationRule>(`/users/${userId}/email-automation-rules`, payload, {
      headers: { 'X-Suppress-Error-Toast': '1' },
    })
    .then((r) => r.data)

export const updateEmailAutomationRule = (
  userId: number,
  ruleId: number,
  payload: UpdateEmailAutomationRulePayload,
) =>
  api
    .patch<EmailAutomationRule>(`/users/${userId}/email-automation-rules/${ruleId}`, payload, {
      headers: { 'X-Suppress-Error-Toast': '1' },
    })
    .then((r) => r.data)

export const deleteEmailAutomationRule = (userId: number, ruleId: number) =>
  api
    .delete<{ ok: boolean }>(`/users/${userId}/email-automation-rules/${ruleId}`, {
      headers: { 'X-Suppress-Error-Toast': '1' },
    })
    .then((r) => r.data)
