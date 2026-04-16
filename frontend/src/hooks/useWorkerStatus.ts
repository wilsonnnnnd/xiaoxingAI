import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'

export const useWorkerStatus = () => {
  const qc = useQueryClient()
  const isAuthed = !!localStorage.getItem('auth_token')

  useEffect(() => {
    if (!isAuthed) return
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wWorker = new WebSocket(`${proto}://${window.location.host}/api/ws/worker/status`)

    wWorker.onmessage = (e) => {
      try { 
        qc.setQueryData(['gmailworkstatus'], JSON.parse(e.data)) 
      } catch { /* ignore */ }
    }

    return () => {
      try { wWorker.close() } catch { /* ignore */ }
    }
  }, [qc, isAuthed])

  const { data: gmailWorker } = useQuery({ 
    queryKey: ['gmailworkstatus'], 
    queryFn: getGmailWorkStatus, 
    enabled: false 
  })

  return { gmailWorker }
}
