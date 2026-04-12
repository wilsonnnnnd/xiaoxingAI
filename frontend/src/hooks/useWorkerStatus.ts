import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getGmailWorkStatus } from '../features/gmail/api'
import { getChatWorkStatus } from '../features/chat/api'

export const useWorkerStatus = () => {
  const qc = useQueryClient()

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wWorker = new WebSocket(`${proto}://${window.location.host}/api/ws/worker/status`)
    const wBot = new WebSocket(`${proto}://${window.location.host}/api/ws/bot/status`)

    wWorker.onmessage = (e) => {
      try { 
        qc.setQueryData(['gmailworkstatus'], JSON.parse(e.data)) 
      } catch { /* ignore */ }
    }
    
    wBot.onmessage = (e) => {
      try { 
        qc.setQueryData(['chatworkstatus'], JSON.parse(e.data)) 
      } catch { /* ignore */ }
    }

    return () => {
      try { wWorker.close() } catch { /* ignore */ }
      try { wBot.close() } catch { /* ignore */ }
    }
  }, [qc])

  const { data: gmailWorker } = useQuery({ 
    queryKey: ['gmailworkstatus'], 
    queryFn: getGmailWorkStatus, 
    enabled: false 
  })
  
  const { data: chatBot } = useQuery({ 
    queryKey: ['chatworkstatus'], 
    queryFn: getChatWorkStatus, 
    enabled: false 
  })

  return { gmailWorker, chatBot }
}
