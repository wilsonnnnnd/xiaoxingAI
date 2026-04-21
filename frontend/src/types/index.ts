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
  final_status?: string
  processed_at?: string
  reply_drafts?: Record<string, unknown>
  processing_result?: Record<string, unknown>
  created_at: string
}

export type EmailCategory = 'job' | 'finance' | 'social' | 'spam' | 'other'
export type EmailPriority = 'high' | 'medium' | 'low'
export type EmailSuggestedAction = 'reply' | 'ignore' | 'archive' | 'notify' | 'review'
export type EmailAutomationRuleAction = 'notify' | 'mark_read'
export type EmailProcessingStatus =
  | 'processed'
  | 'processed_with_fallback'
  | 'partially_failed'
  | 'failed'

export interface ProcessedEmailListItem {
  id: number
  subject: string
  sender: string
  summary: string
  category: EmailCategory
  priority: EmailPriority
  suggested_action: EmailSuggestedAction
  processing_status: EmailProcessingStatus
  processed_at: string
  has_reply_drafts: boolean
}

export interface ProcessedEmailListResponse {
  count: number
  page: number
  page_size: number
  emails: ProcessedEmailListItem[]
}

export interface ProcessedEmailStats {
  processed_today: number
  high_priority: number
  with_reply_drafts: number
  active_rules: number
}

export interface ProcessedEmailAnalysis {
  category?: EmailCategory
  priority?: EmailPriority
  summary?: string
  action?: EmailSuggestedAction
  reason?: string
  deadline?: string | null
}

export interface ProcessedEmailMatchedRule {
  rule: string
  detail: string
  action?: string | null
  metadata: Record<string, unknown>
}

export interface ProcessedEmailExecutedAction {
  action: string
  success: boolean
  optional: boolean
  message: string
  metadata: Record<string, unknown>
}

export type ReplyDraftTone = 'formal' | 'friendly' | 'concise'

export interface ProcessedEmailReplyOption {
  label: string
  tone: ReplyDraftTone
  content: string
}

export interface ProcessedEmailReplyDrafts {
  options: ProcessedEmailReplyOption[]
  style_preference?: string | null
}

export interface ProcessedEmailDetail {
  id: number
  subject: string
  sender: string
  processed_at: string
  processing_status: EmailProcessingStatus
  original_email_content: string
  analysis: ProcessedEmailAnalysis
  matched_rules: ProcessedEmailMatchedRule[]
  executed_actions: ProcessedEmailExecutedAction[]
  reply_drafts: ProcessedEmailReplyDrafts
  summary?: string | null
}

export interface EmailAutomationRule {
  id: number
  user_id: number
  category?: EmailCategory | null
  priority?: EmailPriority | null
  action: EmailAutomationRuleAction
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface Config {
  LLM_BACKEND: string
  LLM_API_URL: string
  LLM_MODEL: string
  LLM_API_KEY?: string
  ROUTER_API_KEY?: string
  HAS_LLM_API_KEY?: boolean
  HAS_ROUTER_API_KEY?: boolean
  ROUTER_API_URL?: string
  ROUTER_MODEL?: string
  GMAIL_POLL_INTERVAL: string
  GMAIL_POLL_QUERY: string
  GMAIL_POLL_MAX: string
  GMAIL_MARK_READ: string
  NOTIFY_MIN_PRIORITY: string
  PROMPT_ANALYZE: string
  PROMPT_SUMMARY: string
  PROMPT_TELEGRAM: string
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
  ui_lang?: 'en' | 'zh'
  notify_lang?: 'en' | 'zh'
}

export interface User {
  id: number
  email: string
  role: string
  worker_enabled: boolean
  min_priority: string
  max_emails_per_run: number
  poll_interval: number
  gmail_poll_query: string
  ui_lang?: 'en' | 'zh'
  notify_lang?: 'en' | 'zh'
  created_at: string
}

export interface Bot {
  id: number
  user_id: number
  name: string
  token: string
  chat_id: string
  is_default: boolean
  bot_mode: string
  created_at: string
}

export interface RegisterInvite {
  id: number
  code: string
  created_by: number | null
  created_by_email?: string | null
  note?: string | null
  created_at: string
  expires_at: string
  used_at?: string | null
  used_by?: number | null
  used_by_email?: string | null
  used_email?: string | null
  used_ip?: string | null
  revoked_at?: string | null
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

export type PersonaConfigData = Record<string, Record<string, string>>
