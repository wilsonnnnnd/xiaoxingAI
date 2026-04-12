import { z } from 'zod'

export const settingsSchema = z.object({
  // Global Config
  LLM_BACKEND: z.string(),
  LLM_MODEL: z.string().min(1, 'Model is required'),
  LLM_API_URL: z.string().url('Invalid URL'),
  OPENAI_API_KEY: z.string().optional(),
  GMAIL_MARK_READ: z.string(),
  GMAIL_POLL_QUERY: z.string(),
  UI_LANG: z.enum(['en', 'zh']),
  
  // User Personal Settings
  min_priority: z.enum(['high', 'medium', 'low']),
  max_emails_per_run: z.number().min(1).max(100),
  poll_interval: z.number().min(60, 'Minimum 60 seconds'),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
