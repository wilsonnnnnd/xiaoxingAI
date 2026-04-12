import { useState, useEffect } from 'react'
import { getHealth } from '../features/system/api'

export const useHealthCheck = (interval = 15000) => {
  const [apiOk, setApiOk] = useState<boolean | null>(null)

  useEffect(() => {
    const check = () => 
      getHealth()
        .then(() => setApiOk(true))
        .catch(() => setApiOk(false))
    
    check()
    const id = setInterval(check, interval)
    return () => clearInterval(id)
  }, [interval])

  return apiOk
}
