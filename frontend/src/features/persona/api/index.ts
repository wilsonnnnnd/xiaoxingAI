import { api } from '../../../api/client'
import type { PersonaConfigData } from '../../../types'

export const getPersonaConfig = () =>
  api.get<PersonaConfigData>('/admin/persona-config').then(r => r.data)

export const savePersonaConfigItem = (category: string, key: string, content: string) =>
  api.put<{ ok: boolean }>('/admin/persona-config', { category, key, content }).then(r => r.data)
