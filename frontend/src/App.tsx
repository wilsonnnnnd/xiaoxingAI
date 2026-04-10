import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Skill from './pages/Skill'
import Gmail from './pages/skills/Gmail'
import Chat from './pages/skills/Chat'
import Settings from './pages/Settings'
import Prompts from './pages/Prompts'
import Debug from './pages/Debug'
import Login from './pages/Login'
import Users from './pages/Users'
import PersonaConfig from './pages/PersonaConfig'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="skill" element={<Skill />} />
        <Route path="skill/gmail" element={<Gmail />} />
        <Route path="skill/chat" element={<Chat />} />
        <Route path="settings" element={<Settings />} />
        <Route path="prompts" element={<Prompts />} />
        <Route path="debug" element={<Debug />} />
        <Route path="users" element={<Users />} />
        <Route path="persona-config" element={<PersonaConfig />} />
      </Route>
    </Routes>
  )
}
