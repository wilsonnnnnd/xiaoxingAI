import { api } from '../../../api/client'
import type { PromptFile, DbPrompt } from '../../../types'

export const listPrompts = () =>
  api.get<{ files: string[]; defaults: string[]; custom: string[] }>('/prompts').then(r => r.data)

export const getPrompt = (filename: string) =>
  api.get<PromptFile>(`/prompts/${filename}`).then(r => r.data)

export const savePrompt = (filename: string, content: string) =>
  api.post(`/prompts/${filename}`, { content }).then(r => r.data)

export const deletePrompt = (filename: string) =>
  api.delete(`/prompts/${filename}`).then(r => r.data)

export const getDbPrompts = () =>
  api.get<{ prompts: DbPrompt[] }>('/db/prompts').then(r => r.data.prompts)

export const createDbPrompt = (data: { name: string; type: string; content: string }) =>
  api.post<DbPrompt>('/db/prompts', data).then(r => r.data)

export const updateDbPrompt = (id: number, data: { name?: string; content?: string }) =>
  api.put<DbPrompt>(`/db/prompts/${id}`, data).then(r => r.data)

export const deleteDbPrompt = (id: number) =>
  api.delete(`/db/prompts/${id}`).then(r => r.data)
