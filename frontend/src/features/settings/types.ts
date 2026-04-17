import { z } from 'zod'

export const settingsSchema = z.object({
  // Global Config
  USE_ONLINE_AI: z.coerce.boolean(),
  LLM_MODEL: z.string().min(1, 'Model is required'),
  LLM_API_URL: z.string().url('Invalid URL'),
  LLM_API_KEY: z.string().optional(),
  ROUTER_API_URL: z.string().optional(),
  ROUTER_MODEL: z.string().optional(),
  ROUTER_API_KEY: z.string().optional(),
  GMAIL_MARK_READ: z.string(),
  GMAIL_POLL_QUERY: z.string(),
  NOTIFY_LANG: z.enum(['en', 'zh']),
  
  // User Personal Settings
  min_priority: z.enum(['high', 'medium', 'low']),
  max_emails_per_run: z.coerce.number().int().min(1).max(100),
  poll_interval: z.coerce.number().int().min(60, 'Minimum 60 seconds'),
})

export type SettingsFormInput = z.input<typeof settingsSchema>

export type SettingsFormValues = z.output<typeof settingsSchema>
