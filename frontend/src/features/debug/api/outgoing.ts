
import { api } from '../../../api/client'

export type TelegramEvent = Record<string, unknown>

export const getTelegramEvents = (limit = 100) =>
  api.get<{ events: TelegramEvent[] }>(`/debug/telegram/events?limit=${limit}`).then(r => r.data)

export const getTelegramMessage = (payload: { bot_id: number; chat_id: string; message_id: number }) =>
  api.get(`/debug/telegram/message?bot_id=${payload.bot_id}&chat_id=${encodeURIComponent(payload.chat_id)}&message_id=${payload.message_id}`).then(r => r.data)

export const getOutgoingDrafts = (limit = 30, includeBody = true) =>
  api.get<{ drafts: Record<string, unknown>[] }>(`/debug/outgoing/drafts?limit=${limit}&include_body=${includeBody ? 'true' : 'false'}`).then(r => r.data)

export const getOutgoingActions = (limit = 200) =>
  api.get<{ actions: Record<string, unknown>[] }>(`/debug/outgoing/actions?limit=${limit}`).then(r => r.data)

export const getOutgoingTrace = (limit = 200) =>
  api.get<{ events: TelegramEvent[] }>(`/debug/outgoing/trace?limit=${limit}`).then(r => r.data)

export const simulateReply = (payload: { user_id: number; email_id: string; user_reply: string }) =>
  api.post(`/debug/outgoing/simulate_reply`, payload).then(r => r.data)

export const debugSendDraft = (draftId: number, userId: number) =>
  api.post(`/debug/outgoing/drafts/${draftId}/send?user_id=${userId}`).then(r => r.data)

export const clearDebugCache = (payload: { bot_id?: number; chat_id?: string; clear_traces?: boolean }) =>
  api.post(`/debug/cache/clear`, payload).then(r => r.data)
