import { api } from './client'

// ── Types ────────────────────────────────────────────────────────

export interface WorkerStatus {
  running: boolean
  interval: number
  query: string
  priorities: string[]
  started_at: string | null
  last_poll: string | null
  total_fetched: number
  total_sent: number
  total_errors: number
  total_tokens: number
  total_runtime_hours: number
  last_error: string | null
}

export interface LogEntry {
  id: number
  ts: string
  level: string
  log_type: string
  tokens: number
  msg: string
}

export interface DbStats {
  db_path: string
  sender_count: number
  log_count: number
  email_records_count: number
  has_token: boolean
}

export interface EmailRecord {
  id: number
  email_id: string
  subject: string
  sender: string
  date: string
  body: string
  analysis: Record<string, unknown>
  summary: Record<string, unknown>
  telegram_msg: string
  tokens: number
  priority: string
  sent_telegram: boolean
  created_at: string
}

export interface Config {
  LLM_BACKEND: string
  LLM_API_URL: string
  LLM_MODEL: string
  OPENAI_API_KEY: string
  GMAIL_POLL_INTERVAL: string
  GMAIL_POLL_QUERY: string
  GMAIL_POLL_MAX: string
  GMAIL_MARK_READ: string
  NOTIFY_MIN_PRIORITY: string
  TELEGRAM_BOT_TOKEN: string
  TELEGRAM_CHAT_ID: string
  PROMPT_ANALYZE: string
  PROMPT_SUMMARY: string
  PROMPT_TELEGRAM: string
  PROMPT_CHAT: string
  PROMPT_PROFILE: string
  UI_LANG: string
}

export interface PromptFile {
  filename: string
  content: string
}

// ── System ───────────────────────────────────────────────────────

export const getHealth = () => api.get<{ status: string }>('/health').then(r => r.data)
export const getDbStats = () => api.get<DbStats>('/db/stats').then(r => r.data)

// ── Worker ───────────────────────────────────────────────────────

export const getWorkerStatus = () => api.get<WorkerStatus>('/worker/status').then(r => r.data)
export const startWorker = () => api.post<{ ok: boolean; status: WorkerStatus }>('/worker/start').then(r => r.data)
export const stopWorker = () => api.post<{ ok: boolean; status: WorkerStatus }>('/worker/stop').then(r => r.data)
export const pollNow = () => api.post('/worker/poll').then(r => r.data)

export const getLogs = (limit = 100, log_type?: string) =>
  api.get<{ logs: LogEntry[] }>('/worker/logs', { params: { limit, log_type } }).then(r => r.data.logs)

export const clearLogs = () => api.delete('/worker/logs').then(r => r.data)

// ── Gmail ────────────────────────────────────────────────────────

export const getGmailAuthUrl = () => `${window.location.origin}/api/gmail/auth`

// ── Telegram Bot ─────────────────────────────────────────────────

export const getBotStatus = () => api.get<{ running: boolean }>('/telegram/bot/status').then(r => r.data)
export const startBot = () => api.post<{ ok: boolean; running: boolean }>('/telegram/bot/start').then(r => r.data)
export const stopBot = () => api.post<{ ok: boolean; running: boolean }>('/telegram/bot/stop').then(r => r.data)
export const clearBotHistory = () => api.post('/telegram/bot/clear_history').then(r => r.data)
export const testTelegram = () => api.post<{ ok: boolean }>('/telegram/test').then(r => r.data)

// ── Email Records ────────────────────────────────────────────────

export const getEmailRecords = (limit = 50, priority?: string) =>
  api.get<{ count: number; records: EmailRecord[] }>('/email/records', { params: { limit, priority } }).then(r => r.data)

export const getEmailRecord = (email_id: string) =>
  api.get<EmailRecord>(`/email/records/${email_id}`).then(r => r.data)

// ── Config ───────────────────────────────────────────────────────

export const getConfig = () => api.get<Config>('/config').then(r => r.data)
export const saveConfig = (patch: Partial<Config>) => api.post<{ ok: boolean }>('/config', patch).then(r => r.data)

// ── Prompts ──────────────────────────────────────────────────────

export const listPrompts = () =>
  api.get<{ files: string[]; defaults: Record<string, string> }>('/prompts').then(r => r.data)

export const getPrompt = (filename: string) =>
  api.get<PromptFile>(`/prompts/${filename}`).then(r => r.data)

export const savePrompt = (filename: string, content: string) =>
  api.post(`/prompts/${filename}`, { content }).then(r => r.data)

export const deletePrompt = (filename: string) =>
  api.delete(`/prompts/${filename}`).then(r => r.data)

// ── AI Debug ─────────────────────────────────────────────────────

export const pingAi = () => api.get<{ ok: boolean; backend: string; reply: string }>('/ai/ping').then(r => r.data)

export const processEmail = (subject: string, body: string) =>
  api.post('/ai/process', { subject, body }).then(r => r.data)
