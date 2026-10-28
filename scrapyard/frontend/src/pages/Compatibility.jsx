import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import VehicleInputs from '../vehicle-inputs'
import { Badge, Button, Card, ConditionBadge, ErrorBox, Field, Input, PageHeader, Select, StockBadge, cx, td, th } from '../ui'

const emptyVehicle = { make: '', model: '', variant: '' }

const vehicleLabel = (v, year) =>
  [v.make, v.model, year, v.variant].filter((x) => x !== '' && x != null).join(' ')

function ViaBadge({ via }) {
  return via === 'direct' ? (
    <Badge tone="green">Recorded fit</Badge>
  ) : (
    <Badge tone="blue">Via interchange</Badge>
  )
}

function MatchTable({ matches }) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
      <table className="min-w-full divide-y divide-slate-100">
        <thead>
          <tr>
            <th className={th}>Part number</th>
            <th className={th}>Name</th>
            <th className={th}>Condition</th>
            <th className={th}>Stock</th>
            <th className={th}>Location</th>
            <th className={th}>Match</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {matches.map(({ part, via }) => (
            <tr key={part.id} className="hover:bg-slate-50">
              <td className={td}>
                <Link to={`/parts/${part.id}`} className="font-medium text-amber-700 hover:underline">
                  {part.part_number}
                </Link>
              </td>
              <td className={td}>{part.name}</td>
              <td className={td}>
                <ConditionBadge condition={part.condition} />
              </td>
              <td className={td}>
                <StockBadge quantity={part.quantity} />
              </td>
              <td className={td}>{part.location_note || '—'}</td>
              <td className={td}>
                <ViaBadge via={via} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CheckTab() {
  const [partNumber, setPartNumber] = useState('')
  const [vehicle, setVehicle] = useState(emptyVehicle)
  const [year, setYear] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const data = await api('/compat/check', {
        query: { part_number: partNumber, make: vehicle.make, model: vehicle.model, year, variant: vehicle.variant },
      })
      setResult({ data, asked: vehicleLabel(vehicle, year) })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const data = result?.data

  return (
    <div className="space-y-4">
      <Card title="Does this part fit this vehicle?">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Part number">
              <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required autoFocus />
            </Field>
            <VehicleInputs value={vehicle} onChange={(k, v) => setVehicle((s) => ({ ...s, [k]: v }))} />
            <Field label="Model year">
              <Input type="number" min="1900" max="2100" value={year} onChange={(e) => setYear(e.target.value)} required />
            </Field>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Check'}
          </Button>
        </form>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      {data && !data.part_found && (
        <div className="rounded-xl bg-slate-100 p-5 text-sm text-slate-700">
          <div className="font-semibold">Part number not in your catalog</div>
          <p className="mt-1">
            Nothing matches that part number. Check the number, or <Link to="/parts" className="text-amber-700 underline">add the part</Link> and
            its fitments first.
          </p>
        </div>
      )}

      {data?.part_found && (
        <div
          className={cx(
            'rounded-xl p-5 ring-1',
            data.compatible ? 'bg-emerald-50 ring-emerald-600/20' : 'bg-red-50 ring-red-600/20',
          )}
        >
          <div className={cx('text-lg font-semibold', data.compatible ? 'text-emerald-800' : 'text-red-800')}>
            {data.compatible ? '✓ Compatible' : '✗ No fitment recorded'}
          </div>
          <p className="mt-1 text-sm text-slate-700">
            <Link to={`/parts/${data.part.id}`} className="font-medium underline">
              {data.part.part_number}
            </Link>{' '}
            ({data.part.name}) —{' '}
            {data.compatible
              ? data.matched_via === 'direct'
                ? `has a recorded fitment for ${result.asked}.`
                : `fits ${result.asked} through an interchangeable part.`
              : `your data has no fitment for ${result.asked}. That means "not recorded", not proof that it won't fit.`}
          </p>
        </div>
      )}

      {data?.compatible && (
        <Card title="In stock and fitting this vehicle">
          {data.in_stock_options.length === 0 ? (
            <p className="text-sm text-slate-500">This part and its interchangeable parts are all out of stock.</p>
          ) : (
            <MatchTable matches={data.in_stock_options} />
          )}
        </Card>
      )}
    </div>
  )
}

function FindTab() {
  const [vehicle, setVehicle] = useState(emptyVehicle)
  const [year, setYear] = useState('')
  const [category, setCategory] = useState('')
  const [inStockOnly, setInStockOnly] = useState(true)
  const [categories, setCategories] = useState([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/parts/categories').then(setCategories).catch(() => {})
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const matches = await api('/compat/search', {
        query: {
          make: vehicle.make,
          model: vehicle.model,
          year,
          variant: vehicle.variant,
          category,
          in_stock_only: inStockOnly,
        },
      })
      setResult({ matches, asked: vehicleLabel(vehicle, year) })
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card title="Which parts fit this vehicle?">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <VehicleInputs value={vehicle} onChange={(k, v) => setVehicle((s) => ({ ...s, [k]: v }))} />
            <Field label="Model year" hint="Optional — leave blank for all years">
              <Input type="number" min="1900" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="rounded" />
            In stock only
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Searching…' : 'Find parts'}
          </Button>
        </form>
      </Card>

      <ErrorBox>{error}</ErrorBox>

      {result && (
        <Card title={`${result.matches.length} part${result.matches.length === 1 ? '' : 's'} for ${result.asked}`}>
          {result.matches.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nothing in your data fits that vehicle{inStockOnly ? ' and is in stock' : ''}. Try unticking “In stock only”, or check the
              spelling of the make and model.
            </p>
          ) : (
            <MatchTable matches={result.matches} />
          )}
        </Card>
      )}
    </div>
  )
}

export default function Compatibility() {
  const [tab, setTab] = useState('check')
  const tabClass = (name) =>
    cx(
      'rounded-md px-4 py-2 text-sm font-medium transition',
      tab === name ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
    )

  return (
    <>
      <PageHeader title="Compatibility checker" subtitle="Answers come from the fitment data you've recorded" />
      <div className="mb-4 inline-flex rounded-lg bg-slate-200/70 p-1">
        <button type="button" className={tabClass('check')} onClick={() => setTab('check')}>
          Check a part
        </button>
        <button type="button" className={tabClass('find')} onClick={() => setTab('find')}>
          Find parts for a vehicle
        </button>
      </div>
      {tab === 'check' ? <CheckTab /> : <FindTab />}
    </>
  )
}
