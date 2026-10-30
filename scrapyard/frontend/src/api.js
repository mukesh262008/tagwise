const KEY = 'scrapyard.tokens'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

let tokens = load()

export const hasTokens = () => !!tokens

export function setTokens(next) {
  tokens = next
  if (next) localStorage.setItem(KEY, JSON.stringify(next))
  else localStorage.removeItem(KEY)
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let refreshing = null

function refresh() {
  if (!tokens?.refresh_token) return Promise.resolve(false)
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      setTokens(await res.json())
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function errorMessage(res) {
  try {
    const data = await res.json()
    if (typeof data.detail === 'string') return data.detail
    if (Array.isArray(data.detail)) {
      return data.detail.map((e) => `${(e.loc || []).slice(1).join('.')}: ${e.msg}`).join('; ')
    }
  } catch {
    /* not JSON */
  }
  return `Request failed (${res.status})`
}

function buildUrl(path, query) {
  const entries = Object.entries(query || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
  return `/api${path}${qs ? `?${qs}` : ''}`
}

/**
 * api('/parts', { query: {q: 'x'} })
 * api('/parts', { method: 'POST', json: {...} })
 * api('/parts/import', { method: 'POST', form: formData })
 */
export async function api(path, opts = {}, retry = true) {
  const { method = 'GET', json, form, query, auth = true } = opts
  const headers = {}
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  if (auth && tokens) headers.Authorization = `Bearer ${tokens.access_token}`

  const res = await fetch(buildUrl(path, query), { method, headers, body })

  if (res.status === 401 && auth) {
    if (retry && (await refresh())) return api(path, opts, false)
    setTokens(null)
    window.dispatchEvent(new Event('auth:logout'))
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return res.status === 204 ? null : res.json()
}
