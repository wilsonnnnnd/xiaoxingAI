import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Skill from './pages/Skill'
import Settings from './pages/Settings'
import Prompts from './pages/Prompts'
import Debug from './pages/Debug'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="skill" element={<Skill />} />
        <Route path="settings" element={<Settings />} />
        <Route path="prompts" element={<Prompts />} />
        <Route path="debug" element={<Debug />} />
      </Route>
    </Routes>
  )
}
