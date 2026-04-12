import { api } from '../../../api/client'
import type { PersonaGenerateResult } from '../../../types'

export const getChatWorkStatus = () => api.get<{ running: boolean }>('/chat/workstatus').then(r => r.data)

export const startBot = () => api.post<{ ok: boolean; running: boolean }>('/telegram/bot/start').then(r => r.data)

export const stopBot = () => api.post<{ ok: boolean; running: boolean }>('/telegram/bot/stop').then(r => r.data)

export const clearBotHistory = () => api.post('/telegram/bot/clear_history').then(r => r.data)

export const generateChatPersona = (
  keywords: string,
  zodiac?: string,
  chinese_zodiac?: string,
  gender?: string,
  age?: string,
) =>
  api.post<PersonaGenerateResult>('/chat/generate_persona_prompt', {
    keywords,
    zodiac: zodiac || undefined,
    chinese_zodiac: chinese_zodiac || undefined,
    gender: gender || undefined,
    age: age || undefined,
  }).then(r => r.data)

export const generateBotProfile = () =>
  api.post<{ ok: true; profile: string; tokens: number } | { ok: false; msg: string }>('/telegram/bot/generate_profile').then(r => r.data)
