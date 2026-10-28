import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'
import { Badge, Button, cx } from '../ui'

const linkClass = ({ isActive }) =>
  cx(
    'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-amber-500/15 text-amber-300' : 'text-slate-300 hover:bg-white/5 hover:text-white',
  )

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="bg-slate-900 md:min-h-screen md:w-56 md:shrink-0">
        <div className="px-4 pt-4 md:py-6">
          <div className="text-base font-semibold text-white">Scrap Yard</div>
          <div className="text-xs text-slate-400">Inventory &amp; compatibility</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-col md:py-2">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/parts" className={linkClass}>
            Parts
          </NavLink>
          <NavLink to="/compatibility" className={linkClass}>
            Compatibility
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/import" className={linkClass}>
                Import CSV
              </NavLink>
              <NavLink to="/users" className={linkClass}>
                Users
              </NavLink>
            </>
          )}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
          <span className="text-sm text-slate-600">{user.full_name || user.username}</span>
          <Badge tone={isAdmin ? 'amber' : 'slate'}>{user.role}</Badge>
          <Button variant="secondary" onClick={logout} className="px-3 py-1.5">
            Sign out
          </Button>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
