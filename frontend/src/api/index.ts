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
  user_id: number | null
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
  is_custom: boolean
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

export const clearLogs = (log_type?: string) => api.delete('/worker/logs', { params: { log_type } }).then(r => r.data)

// ── Gmail ────────────────────────────────────────────────────────

export const getGmailAuthUrl = () =>
  api.get<{ url: string }>('/gmail/auth/url').then(r => r.data.url)

// ── Telegram Bot ─────────────────────────────────────────────────

export const getChatWorkStatus = () => api.get<{ running: boolean }>('/chat/workstatus').then(r => r.data)
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
  api.get<{ files: string[]; defaults: string[]; custom: string[] }>('/prompts').then(r => r.data)

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

// Frontend-friendly Gmail status endpoint (separate name)
export const getGmailWorkStatus = () => api.get<WorkerStatus>('/gmail/workstatus').then(r => r.data)

// ── Auth & User Types ────────────────────────────────────────────

export interface AuthUser {
  id: number
  email: string
  role: string
}

export interface User {
  id: number
  email: string
  role: string
  worker_enabled: boolean
  min_priority: string
  max_emails_per_run: number
  poll_interval: number
  created_at: string
}

export interface Bot {
  id: number
  user_id: number
  name: string
  token: string
  chat_id: string
  is_default: boolean
  chat_prompt_id: number | null
  created_at: string
}

export interface DbPrompt {
  id: number
  user_id: number | null
  name: string
  type: string
  content: string
  is_default: boolean
  created_at: string
}

// ── Auth ─────────────────────────────────────────────────────────

export const login = (email: string, password: string) =>
  api.post<{ access_token: string; token_type: string }>('/auth/login', { email, password }).then(r => r.data)

export const getMe = () => api.get<AuthUser>('/auth/me').then(r => r.data)

// ── Users ─────────────────────────────────────────────────────────

export const listUsers = () =>
  api.get<{ users: User[] }>('/users').then(r => r.data.users)

export const createUser = (data: { email: string; password: string; display_name?: string }) =>
  api.post<User>('/users', data).then(r => r.data)

export const getUser = (id: number) => api.get<User>(`/users/${id}`).then(r => r.data)

export const updateUser = (id: number, patch: Partial<Pick<User, 'worker_enabled' | 'min_priority' | 'max_emails_per_run' | 'poll_interval'>>) =>
  api.put<User>(`/users/${id}`, patch).then(r => r.data)

// ── Bots ──────────────────────────────────────────────────────────

export const listBots = (userId: number) =>
  api.get<{ bots: Bot[] }>(`/users/${userId}/bots`).then(r => r.data.bots)

export const createBot = (userId: number, data: { name: string; token: string; chat_id: string; chat_prompt_id?: number | null }) =>
  api.post<Bot>(`/users/${userId}/bots`, data).then(r => r.data)

export const updateBot = (userId: number, botId: number, data: { name?: string; token?: string; chat_id?: string; chat_prompt_id?: number | null }) =>
  api.put<Bot>(`/users/${userId}/bots/${botId}`, data).then(r => r.data)

export const deleteBot = (userId: number, botId: number) =>
  api.delete(`/users/${userId}/bots/${botId}`).then(r => r.data)

export const setDefaultBot = (userId: number, botId: number) =>
  api.post(`/users/${userId}/bots/${botId}/set-default`).then(r => r.data)

// ── DB Prompts ────────────────────────────────────────────────────

export const listDbPrompts = () => api.get<DbPrompt[]>('/db/prompts').then(r => r.data)

export const createDbPrompt = (data: { name: string; type: string; content: string }) =>
  api.post<DbPrompt>('/db/prompts', data).then(r => r.data)

export const updateDbPrompt = (id: number, data: { name?: string; content?: string }) =>
  api.put<DbPrompt>(`/db/prompts/${id}`, data).then(r => r.data)

export const deleteDbPrompt = (id: number) =>
  api.delete(`/db/prompts/${id}`).then(r => r.data)
