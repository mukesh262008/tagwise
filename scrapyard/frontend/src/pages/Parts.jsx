import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useDebounce } from '../useDebounce'
import { Button, Card, ConditionBadge, ErrorBox, Input, PageHeader, Select, StockBadge, td, th } from '../ui'
import PartForm from './PartForm'

const PAGE = 50

export default function Parts() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState('')
  const [inStock, setInStock] = useState(false)
  const [page, setPage] = useState(0)
  const [categories, setCategories] = useState([])
  const [data, setData] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingPart, setEditingPart] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const dq = useDebounce(q)

  useEffect(() => {
    api('/parts/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    let stale = false
    setLoading(true)
    api('/parts', {
      query: { q: dq, category, condition, in_stock: inStock || undefined, skip: page * PAGE, limit: PAGE },
    })
      .then((d) => {
        if (stale) return
        setData(d)
        setError('')
      })
      .catch((e) => !stale && setError(e.message))
      .finally(() => !stale && setLoading(false))
    return () => {
      stale = true
    }
  }, [dq, category, condition, inStock, page, refresh])

  const filter = (setter) => (e) => {
    setter(e.target.type === 'checkbox' ? e.target.checked : e.target.value)
    setPage(0)
  }
  const pages = Math.max(1, Math.ceil(data.total / PAGE))

  return (
    <>
      <PageHeader title="Parts" subtitle={`${data.total.toLocaleString()} matching`}>
        <Button onClick={() => setAdding(true)}>Add part</Button>
      </PageHeader>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            value={q}
            onChange={filter(setQ)}
            placeholder="Search part number, name or category"
            className="lg:col-span-2"
            aria-label="Search"
          />
          <Select value={category} onChange={filter(setCategory)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select value={condition} onChange={filter(setCondition)} aria-label="Condition">
            <option value="">Any condition</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </Select>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={inStock} onChange={filter(setInStock)} className="rounded" />
          In stock only
        </label>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead>
            <tr>
              <th className={th}>Part number</th>
              <th className={th}>Name</th>
              <th className={th}>Category</th>
              <th className={th}>Condition</th>
              <th className={th}>Stock</th>
              <th className={th}>Location</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className={td}>
                  <Link to={`/parts/${p.id}`} className="font-medium text-amber-700 hover:underline">
                    {p.part_number}
                  </Link>
                </td>
                <td className={td}>{p.name}</td>
                <td className={td}>{p.category || '—'}</td>
                <td className={td}>
                  <ConditionBadge condition={p.condition} />
                </td>
                <td className={td}>
                  <StockBadge quantity={p.quantity} />
                </td>
                <td className={td}>{p.location_note || '—'}</td>
                <td className={td}>
                  <Button variant="secondary" onClick={() => setEditingPart(p)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
            {!loading && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                  No parts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <div className="border-t border-slate-100 p-3 text-center text-xs text-slate-400">Loading…</div>}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {adding && (
        <PartForm onClose={() => setAdding(false)} onSaved={(saved) => navigate(`/parts/${saved.id}`)} />
      )}
      {editingPart && (
        <PartForm
          part={editingPart}
          onClose={() => setEditingPart(null)}
          onSaved={() => {
            setEditingPart(null)
            setRefresh((current) => current + 1)
          }}
        />
      )}
    </>
  )
}
