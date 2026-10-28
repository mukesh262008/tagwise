import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Spinner } from './ui'
import Layout from './pages/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Parts from './pages/Parts'
import PartDetail from './pages/PartDetail'
import Compatibility from './pages/Compatibility'
import Users from './pages/Users'
import ImportCsv from './pages/ImportCsv'

function Protected({ admin = false }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="parts" element={<Parts />} />
          <Route path="parts/:id" element={<PartDetail />} />
          <Route path="compatibility" element={<Compatibility />} />
          <Route element={<Protected admin />}>
            <Route path="users" element={<Users />} />
            <Route path="import" element={<ImportCsv />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
