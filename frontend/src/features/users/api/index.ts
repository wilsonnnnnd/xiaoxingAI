import { api } from '../../../api/client'
import type { User, Bot, RegisterInvite } from '../../../types'
export { getMe } from '../../auth/api'
export const testTelegram = () => api.post('/telegram/test').then(r => r.data)
export const getTelegramChatId = (token: string) =>
  api.get<{ chat_id: string | null }>('/telegram/chat_id', { params: { token } }).then(r => r.data)

export const listUsers = () =>
  api.get<{ users: User[] }>('/users').then(r => r.data.users)

export const createUser = (data: { email: string; password: string; display_name?: string }) =>
  api.post<User>('/users', data).then(r => r.data)

export const getUser = (id: number) => api.get<User>(`/users/${id}`).then(r => r.data)

export const updateUser = (id: number, patch: Partial<Pick<User, 'worker_enabled' | 'min_priority' | 'max_emails_per_run' | 'poll_interval' | 'gmail_poll_query' | 'ui_lang' | 'notify_lang'>>) =>
  api.put<User>(`/users/${id}`, patch).then(r => r.data)

export const listBots = (userId: number) =>
  api.get<{ bots: Bot[] }>(`/users/${userId}/bots`).then(r => r.data.bots)

export const createBot = (userId: number, data: { name: string; token: string; chat_id: string; bot_mode?: string }) =>
  api.post<Bot>(`/users/${userId}/bots`, data).then(r => r.data)

export const updateBot = (userId: number, botId: number, data: { name?: string; token?: string; chat_id?: string; bot_mode?: string }) =>
  api.put<Bot>(`/users/${userId}/bots/${botId}`, data).then(r => r.data)

export const deleteBot = (userId: number, botId: number) =>
  api.delete(`/users/${userId}/bots/${botId}`).then(r => r.data)

export const setDefaultBot = (userId: number, botId: number) =>
  api.post(`/users/${userId}/bots/${botId}/set-default`).then(r => r.data)

export const listInvites = () =>
  api.get<{ invites: RegisterInvite[] }>('/invites').then(r => r.data.invites)

export const createInvite = (data: { ttl_seconds?: number; note?: string }) =>
  api.post<RegisterInvite>('/invites', data).then(r => r.data)

export const revokeInvite = (code: string) =>
  api.post(`/invites/${encodeURIComponent(code)}/revoke`).then(r => r.data)
