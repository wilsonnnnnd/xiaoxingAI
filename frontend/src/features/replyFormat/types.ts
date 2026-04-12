export type ReplyTemplate = {
  id: number
  user_id: number
  name: string
  body_template: string
  closing: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type ReplyFormatState = {
  signature: string
  default_template_id: number | null
  templates: ReplyTemplate[]
}

export type ReplyTemplateCreate = {
  name: string
  body_template: string
  closing?: string | null
  is_default?: boolean
}

export type ReplyTemplateUpdate = {
  name?: string
  body_template?: string
  closing?: string | null
  is_default?: boolean
}

export type ReplyFormatUpdate = {
  signature?: string
  default_template_id?: number | null
}

