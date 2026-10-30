import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import VehicleInputs from '../vehicle-inputs'
import { Button, Card, ConditionBadge, ErrorBox, Field, Input, PageHeader, Spinner, StockBadge, td, th } from '../ui'
import PartForm from './PartForm'

const emptyFit = { make: '', model: '', variant: '', year_from: '', year_to: '', notes: '' }

export default function PartDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [part, setPart] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [fit, setFit] = useState(emptyFit)
  const [linkNumber, setLinkNumber] = useState('')

  useEffect(() => {
    setPart(null)
    api(`/parts/${id}`)
      .then(setPart)
      .catch((e) => setError(e.message))
  }, [id])

  // Runs a mutation that returns the updated part. Resolves true on success.
  async function run(fn) {
    setError('')
    try {
      setPart(await fn())
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  const patch = (json) => run(() => api(`/parts/${id}`, { method: 'PATCH', json }))

  async function addFitment(e) {
    e.preventDefault()
    const yearFrom = Number(fit.year_from)
    const ok = await run(() =>
      api(`/parts/${id}/fitments`, {
        method: 'POST',
        json: { ...fit, year_from: yearFrom, year_to: fit.year_to ? Number(fit.year_to) : yearFrom },
      }),
    )
    if (ok) setFit((f) => ({ ...emptyFit, make: f.make }))
  }

  async function addLink(e) {
    e.preventDefault()
    const ok = await run(() =>
      api(`/parts/${id}/interchanges`, { method: 'POST', json: { part_number: linkNumber } }),
    )
    if (ok) setLinkNumber('')
  }

  async function remove() {
    if (!window.confirm(`Delete ${part.part_number}? This also removes its fitments and links.`)) return
    try {
      await api(`/parts/${id}`, { method: 'DELETE' })
      navigate('/parts')
    } catch (e) {
      setError(e.message)
    }
  }

  if (!part) {
    return error ? (
      <>
        <ErrorBox>{error}</ErrorBox>
        <Link to="/parts" className="mt-3 inline-block text-sm text-amber-700 hover:underline">
          ← Back to parts
        </Link>
      </>
    ) : (
      <Spinner />
    )
  }

  return (
    <>
      <Link to="/parts" className="text-sm text-amber-700 hover:underline">
        ← All parts
      </Link>
      <div className="mt-2" />
      <PageHeader title={part.part_number} subtitle={part.name}>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        {isAdmin && (
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        )}
      </PageHeader>

      <ErrorBox>{error}</ErrorBox>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Stock" className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => patch({ quantity: Math.max(0, part.quantity - 1) })} aria-label="Remove one">
              −
            </Button>
            <div className="min-w-12 text-center text-2xl font-semibold tabular-nums">{part.quantity}</div>
            <Button variant="secondary" onClick={() => patch({ quantity: part.quantity + 1 })} aria-label="Add one">
              +
            </Button>
            <StockBadge quantity={part.quantity} />
          </div>
          <dl className="mt-5 space-y-2 text-sm">
            <Row label="Condition">
              <ConditionBadge condition={part.condition} />
            </Row>
            <Row label="Category">{part.category || '—'}</Row>
            <Row label="Price">{part.price != null ? part.price.toLocaleString() : '—'}</Row>
            <Row label="Location">{part.location_note || '—'}</Row>
          </dl>
          {part.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-slate-500">{part.notes}</p>}
        </Card>

        <Card title={`Fits these vehicles (${part.fitments.length})`} className="lg:col-span-2">
          {part.fitments.length === 0 ? (
            <p className="mb-4 text-sm text-slate-400">
              No fitment recorded yet — the compatibility checker can't answer for this part until you add some.
            </p>
          ) : (
            <div className="-mx-5 mb-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr>
                    <th className={th}>Vehicle</th>
                    <th className={th}>Years</th>
                    <th className={th}>Notes</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {part.fitments.map((f) => (
                    <tr key={f.id}>
                      <td className={td}>
                        {f.vehicle.make} {f.vehicle.model}
                        {f.vehicle.variant && <span className="text-slate-400"> · {f.vehicle.variant}</span>}
                      </td>
                      <td className={`${td} tabular-nums`}>
                        {f.vehicle.year_from === f.vehicle.year_to
                          ? f.vehicle.year_from
                          : `${f.vehicle.year_from}–${f.vehicle.year_to}`}
                      </td>
                      <td className={td}>{f.notes || '—'}</td>
                      <td className={`${td} text-right`}>
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600 hover:underline"
                          onClick={() => run(() => api(`/parts/${id}/fitments/${f.id}`, { method: 'DELETE' }))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={addFitment} className="rounded-lg bg-slate-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Add compatible vehicle</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <VehicleInputs value={fit} onChange={(k, v) => setFit((s) => ({ ...s, [k]: v }))} />
              <Field label="Year from">
                <Input
                  type="number"
                  min="1900"
                  max="2100"
                  value={fit.year_from}
                  onChange={(e) => setFit((s) => ({ ...s, year_from: e.target.value }))}
                  required
                />
              </Field>
              <Field label="Year to" hint="Blank = same as from">
                <Input
                  type="number"
                  min="1900"
                  max="2100"
                  value={fit.year_to}
                  onChange={(e) => setFit((s) => ({ ...s, year_to: e.target.value }))}
                />
              </Field>
              <Field label="Notes">
                <Input value={fit.notes} onChange={(e) => setFit((s) => ({ ...s, notes: e.target.value }))} />
              </Field>
            </div>
            <Button type="submit" className="mt-3">
              Add vehicle
            </Button>
          </form>
        </Card>

        <Card title={`Interchangeable parts (${part.interchanges.length})`} className="lg:col-span-3">
          <p className="mb-3 text-sm text-slate-500">
            Parts you've marked as interchangeable share fitment: if one fits a vehicle, the checker treats the others as fitting too.
            Links are one step only (A↔B and B↔C does not link A to C).
          </p>
          {part.interchanges.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {part.interchanges.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <Link to={`/parts/${p.id}`} className="font-medium text-amber-700 hover:underline">
                      {p.part_number}
                    </Link>
                    <span className="ml-2 text-sm text-slate-500">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StockBadge quantity={p.quantity} />
                    <button
                      type="button"
                      className="text-xs font-medium text-red-600 hover:underline"
                      onClick={() => run(() => api(`/parts/${id}/interchanges/${p.id}`, { method: 'DELETE' }))}
                    >
                      Unlink
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addLink} className="flex flex-wrap items-end gap-3">
            <Field label="Link another part by part number" className="w-full sm:w-72">
              <Input value={linkNumber} onChange={(e) => setLinkNumber(e.target.value)} required />
            </Field>
            <Button type="submit">Link part</Button>
          </form>
        </Card>
      </div>

      {editing && (
        <PartForm
          part={part}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setPart(saved)
            setEditing(false)
          }}
        />
      )}
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  )
}
