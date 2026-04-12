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
  bot_mode: string
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

export interface PersonaGenerateResult {
  prompt: string
  tokens: number
}

export type PersonaConfigData = Record<string, Record<string, string>>
