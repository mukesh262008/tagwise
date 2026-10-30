import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Card, ConditionBadge, ErrorBox, PageHeader, Spinner, StockBadge, cx, td, th } from '../ui'

const fmt = (n) => Number(n ?? 0).toLocaleString()

function Stat({ label, value, hint, tone, to }) {
  const body = (
    <div
      className={cx(
        'rounded-xl bg-white p-4 shadow-sm ring-1 transition',
        tone === 'warn' ? 'ring-amber-300' : 'ring-slate-200',
        to && 'hover:ring-amber-400',
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function BarList({ items }) {
  if (!items.length) return <p className="text-sm text-slate-400">No data yet</p>
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.name}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate capitalize text-slate-700">{i.name}</span>
            <span className="tabular-nums text-slate-500">{fmt(i.count)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-amber-500" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner />

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Stock and fitment data at a glance" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Part types" value={fmt(data.total_parts)} to="/parts" />
        <Stat label="Units in stock" value={fmt(data.total_units)} />
        <Stat label="Stock value" value={fmt(Math.round(data.total_value))} hint="price × quantity, where priced" />
        <Stat label="Out of stock" value={fmt(data.out_of_stock)} />
        <Stat label="Low stock" value={fmt(data.low_stock)} hint="2 units or fewer" />
        <Stat label="Vehicles covered" value={fmt(data.vehicles_covered)} />
        <Stat label="Fitment links" value={fmt(data.fitments)} />
        <Stat
          label="Parts without fitment"
          value={fmt(data.parts_without_fitment)}
          tone={data.parts_without_fitment > 0 ? 'warn' : undefined}
          hint="the checker can't help with these"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Parts by category">
          <BarList items={data.by_category} />
        </Card>
        <Card title="Parts by condition">
          <BarList items={data.by_condition} />
        </Card>
        <Card title="Makes with most fitments">
          <BarList items={data.top_makes} />
        </Card>
      </div>

      <Card title="Recently added" className="mt-6">
        {data.recent_parts.length === 0 ? (
          <p className="text-sm text-slate-400">No parts yet — add one from the Parts page or import a CSV.</p>
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  <th className={th}>Part number</th>
                  <th className={th}>Name</th>
                  <th className={th}>Condition</th>
                  <th className={th}>Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_parts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className={td}>
                      <Link to={`/parts/${p.id}`} className="font-medium text-amber-700 hover:underline">
                        {p.part_number}
                      </Link>
                    </td>
                    <td className={td}>{p.name}</td>
                    <td className={td}>
                      <ConditionBadge condition={p.condition} />
                    </td>
                    <td className={td}>
                      <StockBadge quantity={p.quantity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
