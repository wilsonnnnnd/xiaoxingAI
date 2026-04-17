import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import Home from './pages/Home'
import Help from './pages/Help'
import Skill from './pages/Skill'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import OAuthComplete from './pages/OAuthComplete'
import { GmailPage } from './features/gmail'
import { LoginPage } from './features/auth'
import { SettingsPage } from './features/settings'
import { ReplyFormatPage } from './features/replyFormat'
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
        <Route path="help" element={<Help />} />
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<TermsOfService />} />
        <Route path="oauth/complete" element={<OAuthComplete />} />
        <Route path="skill" element={<Skill />} />
        <Route path="skill/gmail" element={<GmailPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/reply-format" element={<ReplyFormatPage />} />
        <Route path="prompts" element={<PromptsPage />} />
        <Route path="debug" element={<DebugPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
    </Routes>
    </>
  )
}
