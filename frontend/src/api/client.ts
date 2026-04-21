import axios from 'axios'
import toast from 'react-hot-toast'
import { useI18nStore } from '../i18n/store'

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Error code mapping to i18n keys
const ERROR_MAP: Record<number | string, string> = {
  400: 'error.bad_request',
  401: 'error.unauthorized',
  403: 'error.forbidden',
  404: 'error.not_found',
  500: 'error.server_error',
  timeout: 'error.timeout',
  network: 'error.network',
  cancel: 'error.cancelled',
}

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('auth_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    const t = useI18nStore.getState().t
    const headers = err?.config?.headers
    const suppressErrorToast =
      (typeof headers?.get === 'function' && headers.get('X-Suppress-Error-Toast') === '1') ||
      headers?.['X-Suppress-Error-Toast'] === '1' ||
      headers?.['x-suppress-error-toast'] === '1'
    
    if (axios.isCancel(err)) {
      if (!suppressErrorToast) {
        toast.error(t(ERROR_MAP.cancel))
      }
      return Promise.reject(err)
    }

    if (err.code === 'ECONNABORTED') {
      if (!suppressErrorToast) {
        toast.error(t(ERROR_MAP.timeout))
      }
      return Promise.reject(err)
    }

    if (!err.response) {
      if (!suppressErrorToast) {
        toast.error(t(ERROR_MAP.network))
      }
      return Promise.reject(err)
    }

    const { status, data } = err.response

    // Handle 401/403 redirects
    if (status === 401 || status === 403) {
      localStorage.removeItem('auth_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    // Show toast for error
    const msg = data?.detail || data?.message || t(ERROR_MAP[status] || 'error.unknown')
    if (!suppressErrorToast) {
      toast.error(msg)
    }

    return Promise.reject(err)
  },
)
