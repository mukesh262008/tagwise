import { createContext, useContext, useEffect, useState } from 'react'
import { api, hasTokens, setTokens } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(hasTokens())

  useEffect(() => {
    if (!hasTokens()) return
    api('/auth/me')
      .then(setUser)
      .catch(() => setTokens(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  async function login(username, password) {
    const tokens = await api('/auth/login', {
      method: 'POST',
      form: new URLSearchParams({ username, password }),
      auth: false,
    })
    setTokens(tokens)
    setUser(await api('/auth/me'))
  }

  function logout() {
    setTokens(null)
    setUser(null)
  }

  const value = { user, loading, login, logout, isAdmin: user?.role === 'admin' }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
