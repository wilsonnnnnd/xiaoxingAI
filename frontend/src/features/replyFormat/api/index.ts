import { api } from '../../../api/client'
import type { ReplyFormatState, ReplyFormatUpdate, ReplyTemplate, ReplyTemplateCreate, ReplyTemplateUpdate } from '../types'

export async function getReplyFormat(): Promise<ReplyFormatState> {
  const r = await api.get('/reply-format')
  return r.data as ReplyFormatState
}

export async function updateReplyFormat(payload: ReplyFormatUpdate): Promise<ReplyFormatState> {
  const r = await api.put('/reply-format', payload)
  return r.data as ReplyFormatState
}

export async function createReplyTemplate(payload: ReplyTemplateCreate): Promise<ReplyTemplate> {
  const r = await api.post('/reply-templates', payload)
  return r.data as ReplyTemplate
}

export async function updateReplyTemplate(id: number, payload: ReplyTemplateUpdate): Promise<ReplyTemplate> {
  const r = await api.put(`/reply-templates/${id}`, payload)
  return r.data as ReplyTemplate
}

export async function deleteReplyTemplate(id: number): Promise<void> {
  await api.delete(`/reply-templates/${id}`)
}

