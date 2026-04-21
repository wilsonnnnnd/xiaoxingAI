import { api } from '../../../api/client'
import type {
  EmailCategory,
  EmailPriority,
  ProcessedEmailDetail,
  ProcessedEmailListResponse,
  ProcessedEmailStats,
} from '../../../types'

export interface ProcessedEmailsQuery {
  page: number
  page_size: number
  q?: string
  priority?: EmailPriority | ''
  category?: EmailCategory | ''
  has_reply_drafts?: boolean
}

export const getProcessedEmails = (params: ProcessedEmailsQuery) =>
  api.get<ProcessedEmailListResponse>('/emails/processed', { params }).then((r) => r.data)

export const getProcessedEmailStats = () =>
  api.get<ProcessedEmailStats>('/emails/processed/stats').then((r) => r.data)

export const getProcessedEmailDetail = (id: number) =>
  api.get<ProcessedEmailDetail>(`/emails/processed/${id}`).then((r) => r.data)
