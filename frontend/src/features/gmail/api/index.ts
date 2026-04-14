import { api } from '../../../api/client'
import type { WorkerStatus, LogEntry, EmailRecord } from '../../../types'

export const getGmailWorkStatus = () => api.get<WorkerStatus>('/gmail/workstatus').then(r => r.data)

export const startWorker = () => api.post<{ ok: boolean; status: WorkerStatus }>('/worker/start').then(r => r.data)

export const stopWorker = () => api.post<{ ok: boolean; status: WorkerStatus }>('/worker/stop').then(r => r.data)

export const pollNow = () => api.post('/worker/poll').then(r => r.data)

export const getGmailAuthUrl = () =>
  api.get<{ url: string }>('/gmail/auth/url').then(r => r.data.url)
export const getLogs = (limit = 20, log_type?: string, before_id?: number, from_ts?: string, to_ts?: string) =>
  api.get<{ logs: LogEntry[] }>('/worker/logs', { params: { limit, log_type, before_id, from_ts, to_ts } }).then(r => r.data.logs)

export const getLogsWindow = (limit = 20, log_type?: string, before_id?: number, from_ts?: string, to_ts?: string) =>
  api.get<{ logs: LogEntry[]; from_ts: string | null; to_ts: string | null }>('/worker/logs/window', { params: { limit, log_type, before_id, from_ts, to_ts } }).then(r => r.data)

export const clearLogs = (log_type?: string) => api.delete('/worker/logs', { params: { log_type } }).then(r => r.data)

export const getEmailRecords = (limit = 50, priority?: string) =>
  api.get<{ count: number; records: EmailRecord[] }>('/email/records', { params: { limit, priority } }).then(r => r.data)

export const analyzeEmail = (subject: string, body: string) =>
  api.post<{ analysis: Record<string, unknown> }>('/ai/analyze', { subject, body }).then(r => r.data)

export const summaryEmail = (subject: string, body: string) =>
  api.post<{ summary: Record<string, unknown> }>('/ai/summary', { subject, body }).then(r => r.data)

export const processEmail = (subject: string, body: string) =>
  api.post('/ai/process', { subject, body }).then(r => r.data)

export const gmailFetch = (payload: { query: string; max_results: number }) =>
  api.post('/gmail/fetch', payload).then(r => r.data)

export const gmailProcess = (payload: { query: string; max_results: number; mark_read: boolean; send_telegram: boolean }) =>
  api.post('/gmail/process', payload).then(r => r.data)
