import { api } from '../../../api/client'
import type { AuthUser } from '../../../types'

export const login = (email: string, password: string) =>
  api.post<{ access_token: string; token_type: string }>('/auth/login', { email, password }).then(r => r.data)

export const register = (email: string, password: string, display_name?: string, ui_lang?: 'en' | 'zh', notify_lang?: 'en' | 'zh') =>
  api.post<{ access_token: string; token_type: string }>('/auth/register', { email, password, display_name, ui_lang, notify_lang }).then(r => r.data)

export const getMe = () => api.get<AuthUser>('/auth/me').then(r => r.data)

export const changePassword = (old_password: string, new_password: string) =>
  api.post<{ ok: boolean; access_token: string; token_type: string }>('/auth/change-password', { old_password, new_password }).then(r => r.data)
