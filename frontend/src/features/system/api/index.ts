import { api } from '../../../api/client'
import type { DbStats } from '../../../types'

export type HealthPayload = {
  status: string
  db?: boolean
  redis?: boolean
  user_count?: number | null
}

export const getHealth = () => api.get<HealthPayload>('/health').then(r => r.data)
export const getDbStats = () => api.get<DbStats>('/db/stats').then(r => r.data)
