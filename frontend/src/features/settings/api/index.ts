import { api } from '../../../api/client'
import type { Config, PricingConfig } from '../../../types'

export const getConfig = () => api.get<Config>('/config').then(r => r.data)
export const saveConfig = (patch: Partial<Config>) => api.post<{ ok: boolean; config?: Config }>('/config', patch).then(r => r.data)
export const getPricingConfig = () => api.get<PricingConfig>('/config/pricing').then(r => r.data)
export const savePricingConfig = (AI_PRICING_JSON: string) =>
  api.post<{ ok: boolean; pricing: PricingConfig; raw: string }>('/config/pricing', { AI_PRICING_JSON }).then(r => r.data)
