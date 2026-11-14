import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import Act from './pages/Act'
import Check from './pages/Check'
import DemoClaimForm from './pages/DemoClaimForm'
import Home from './pages/Home'
import Log from './pages/Log'
import Result from './pages/Result'

const page = (element: React.ReactNode) => <Shell>{element}</Shell>

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={page(<Home />)} />
        <Route path="/log" element={page(<Log />)} />
        <Route path="/check" element={page(<Check />)} />
        <Route path="/result" element={page(<Result />)} />
        <Route path="/act" element={page(<Act />)} />
        {/* Stands alone on purpose: it plays the part of an outside website. */}
        <Route path="/demo-claim-form" element={<DemoClaimForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
