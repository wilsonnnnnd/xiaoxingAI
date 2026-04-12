import { api } from '../../../api/client'
import type { AuthUser } from '../../../types'

export const login = (email: string, password: string) =>
  api.post<{ access_token: string; token_type: string }>('/auth/login', { email, password }).then(r => r.data)

export const getMe = () => api.get<AuthUser>('/auth/me').then(r => r.data)
