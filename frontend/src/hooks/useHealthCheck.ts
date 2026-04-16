import { useState, useEffect } from 'react'
import { getHealth } from '../features/system/api'

export const useHealthCheck = (interval = 15000) => {
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    const check = () => 
      getHealth()
        .then((r) => {
          setApiOk(r?.status === 'ok')
          setUserCount(typeof r?.user_count === 'number' ? r.user_count : null)
        })
        .catch(() => {
          setApiOk(false)
          setUserCount(null)
        })
    
    check()
    const id = setInterval(check, interval)
    return () => clearInterval(id)
  }, [interval])

  return { ok: apiOk, userCount }
}
