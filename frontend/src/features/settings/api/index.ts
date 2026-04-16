import { api } from '../../../api/client'
import type { Config } from '../../../types'

export const getConfig = () => api.get<Config>('/config').then(r => r.data)
export const saveConfig = (patch: Partial<Config>) => api.post<{ ok: boolean; config?: Config }>('/config', patch).then(r => r.data)
