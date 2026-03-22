import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Dashboard from '@/pages/Dashboard'
import Session from '@/pages/Session'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111520',
            color: '#E2E8F0',
            border: '1px solid rgba(255,255,255,0.07)',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '13px',
            borderRadius: '12px',
          },
          success: { iconTheme: { primary: '#00FFB2', secondary: '#06080F' } },
          error:   { iconTheme: { primary: '#FF4D6D', secondary: '#06080F' } },
        }}
      />
      <Routes>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/session/:id"  element={<Session />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}