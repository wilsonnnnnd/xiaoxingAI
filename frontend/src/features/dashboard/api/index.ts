import { api } from '../../../api/client'
import type { AdminDashboardPayload, UserDashboardPayload } from '../../../types'

export const getAdminDashboard = (days = 30) =>
  api
    .get<AdminDashboardPayload>(`/admin/dashboard`, { params: { days } })
    .then(r => r.data)

export const getUserDashboard = (days = 30) =>
  api
    .get<UserDashboardPayload>(`/dashboard`, { params: { days } })
    .then(r => r.data)
