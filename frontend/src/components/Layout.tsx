import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getMe } from '../features/users/api'
import { Sidebar } from './layout/Sidebar'

export default function Layout() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe, staleTime: 120_000 })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar me={me} />

      <main className="flex-1 overflow-y-auto bg-[#0f172a] flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
