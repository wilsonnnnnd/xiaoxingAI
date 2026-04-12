import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Home from './pages/Home'
import Skill from './pages/Skill'
import { GmailPage } from './features/gmail'
import { ChatPage } from './features/chat'
import { LoginPage } from './features/auth'
import { SettingsPage } from './features/settings'
import { PersonaConfigPage } from './features/persona'
import { PromptsPage } from './features/prompts'
import { UsersPage } from './features/users'
import { DebugPage } from './features/debug'

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="skill" element={<Skill />} />
        <Route path="skill/gmail" element={<GmailPage />} />
        <Route path="skill/chat" element={<ChatPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="prompts" element={<PromptsPage />} />
        <Route path="debug" element={<DebugPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="persona-config" element={<PersonaConfigPage />} />
      </Route>
    </Routes>
    </>
  )
}
