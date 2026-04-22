export interface TelegramUpdatesStatus {
  running: boolean
  mode: 'stopped' | 'polling' | 'webhook' | 'webhook+polling' | string
  webhook_bot_ids?: number[]
  polling_bot_ids?: number[] | 'all'
}

export interface WorkerUserStatus {
  user_id: number
  worker_enabled: boolean
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

export interface WorkerSystemStatus {
  running: boolean
  starting?: boolean
  state?: string
  interval?: number
  query?: string
  priorities?: string[]
  started_at?: string | null
  last_poll?: string | null
  last_error?: string | null
  startup_requested_at?: string | null
  startup_completed_at?: string | null
  startup_error?: string | null
  total_fetched?: number
  total_sent?: number
  total_errors?: number
  total_tokens?: number
  total_runtime_hours?: number
  telegram_updates?: TelegramUpdatesStatus
}

export type WorkerStatusEnvelope =
  | { scope: 'user'; user: WorkerUserStatus; system?: { telegram_updates?: TelegramUpdatesStatus } }
  | { scope: 'global'; system: WorkerSystemStatus; user?: WorkerUserStatus }

export interface LogEntry {
  id: number
  user_id: number | null
  ts: string
  level: string
  log_type: string
  tokens: number
  msg: string
}

export type AdminDashboardPoint = { date: string; value: number }
export type AdminDashboardModelSeries = {
  name: string
  data: AdminDashboardPoint[]
}
export type AdminDashboardTopUser = {
  user_id: number
  display_name: string
  email: string
  total_tokens: number
  estimated_cost_usd: number
  request_count: number
}
export type AdminDashboardBreakdownItem = {
  label: string
  total_tokens: number
  estimated_cost_usd: number
  request_count: number
}

export interface AdminDashboardPayload {
  generated_at: string
  range_days: number
  summary: {
    total_users: number
    active_users_7d: number
    new_users_7d: number
    total_emails_processed: number
    total_tokens_used: number
    estimated_cost_usd: number | null
    paid_members: number | null
  }
  series: {
    user_growth: AdminDashboardPoint[]
    token_usage: AdminDashboardPoint[]
    emails_processed: AdminDashboardPoint[]
    error_count: AdminDashboardPoint[]
    estimated_cost: AdminDashboardPoint[]
    model_usage: AdminDashboardModelSeries[]
  }
  operational: {
    worker_enabled_users: number
    worker_system_status: WorkerSystemStatus
    error_count_24h: number
    error_rate_24h: number
    last_activity_ts: string | null
  }
  membership: {
    paid_members: number | null
    free_members: number | null
    note?: string
  }
  analytics: {
    top_users: {
      by_cost: AdminDashboardTopUser[]
      by_tokens: AdminDashboardTopUser[]
    }
    cost_breakdown: {
      by_model: AdminDashboardBreakdownItem[]
      by_purpose: AdminDashboardBreakdownItem[]
    }
  }
  recent_logs: LogEntry[]
  notes?: {
    estimated_cost?: string
    model_usage?: string
  }
}

export interface UserDashboardPayload {
  generated_at: string
  range_days: number
  summary: {
    total_emails_processed: number
    processed_today: number
    with_reply_drafts: number
    active_rules: number
    total_tokens_used: number
    estimated_cost_usd: number | null
  }
  series: {
    token_usage: AdminDashboardPoint[]
    emails_processed: AdminDashboardPoint[]
    estimated_cost: AdminDashboardPoint[]
  }
  operational: {
    worker_status: WorkerUserStatus
    last_activity_ts: string | null
  }
  membership: {
    plan_name: string | null
    note?: string
  }
  recent_logs: LogEntry[]
  notes?: {
    estimated_cost?: string
  }
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
  has_attachments: boolean
  attachment_count: number
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
  has_attachments: boolean
  attachment_count: number
  attachment_names: string[]
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
  AI_PRICING_JSON?: string
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

export interface PricingConfig {
  fallback: {
    prompt_per_million: string
    completion_per_million: string
  }
  models: Array<{
    model: string
    provider: string
    prompt_per_million: string
    completion_per_million: string
  }>
  source: string
  uses_fallback_defaults: boolean
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
