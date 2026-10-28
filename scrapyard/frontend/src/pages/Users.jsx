import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, td, th } from '../ui'

function NewUserModal({ onClose, onCreated }) {
  const [f, setF] = useState({ username: '', full_name: '', password: '', role: 'worker' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/users', { method: 'POST', json: f })
      onCreated()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Add user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Field label="Username" hint="Lowercase letters, digits, . _ -">
          <Input value={f.username} onChange={set('username')} autoCapitalize="none" required autoFocus />
        </Field>
        <Field label="Full name">
          <Input value={f.full_name} onChange={set('full_name')} />
        </Field>
        <Field label="Temporary password" hint="At least 8 characters">
          <Input type="password" value={f.password} onChange={set('password')} minLength={8} required autoComplete="new-password" />
        </Field>
        <Field label="Role" hint="Workers can manage parts and use the checker. Admins can also manage users, import data and delete parts.">
          <Select value={f.role} onChange={set('role')}>
            <option value="worker">Worker</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', json: { password } })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Reset password for ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Field label="New password" hint="At least 8 characters">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus autoComplete="new-password" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            Set password
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState(null)

  const load = useCallback(() => {
    api('/users')
      .then(setUsers)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(load, [load])

  async function patch(id, json) {
    setError('')
    try {
      await api(`/users/${id}`, { method: 'PATCH', json })
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  if (!users) return error ? <ErrorBox>{error}</ErrorBox> : <Spinner />

  return (
    <>
      <PageHeader title="Users" subtitle="Admins and workers who can sign in">
        <Button onClick={() => setAdding(true)}>Add user</Button>
      </PageHeader>
      <ErrorBox>{error}</ErrorBox>

      <Card className="mt-4">
        <div className="-m-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <th className={th}>Username</th>
                <th className={th}>Name</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const self = u.id === me.id
                return (
                  <tr key={u.id}>
                    <td className={`${td} font-medium`}>
                      {u.username} {self && <span className="text-xs text-slate-400">(you)</span>}
                    </td>
                    <td className={td}>{u.full_name || '—'}</td>
                    <td className={td}>
                      <Select
                        value={u.role}
                        disabled={self}
                        onChange={(e) => patch(u.id, { role: e.target.value })}
                        className="w-28 py-1"
                        aria-label={`Role for ${u.username}`}
                      >
                        <option value="worker">Worker</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className={td}>
                      <Badge tone={u.is_active ? 'green' : 'slate'}>{u.is_active ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className={`${td} space-x-2 text-right`}>
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setResetting(u)}>
                        Reset password
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1"
                        disabled={self}
                        onClick={() => patch(u.id, { is_active: !u.is_active })}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {adding && (
        <NewUserModal
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            load()
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => setResetting(null)}
        />
      )}
    </>
  )
}
