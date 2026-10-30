import { useState } from 'react'
import { api } from '../api'
import { Button, Card, ErrorBox, PageHeader, td, th } from '../ui'

const TEMPLATE =
  'part_number,name,category,condition,quantity,price,notes,make,model,year_from,year_to,variant\n' +
  'EXAMPLE-001,Example alternator,Electrical,good,2,4500,,Example Make,Example Model,2011,2017,\n' +
  'EXAMPLE-001,,,,,,,Example Make,Example Model,2018,2019,1.2 Petrol\n'

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'parts-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportCsv() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      setResult(await api('/parts/import', { method: 'POST', form }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Import from CSV" subtitle="Load parts and their fitments in bulk">
        <Button variant="secondary" onClick={downloadTemplate}>
          Download template
        </Button>
      </PageHeader>

      <Card>
        <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            One row per fitment. Repeat the part number on another row to give the same part another vehicle (leave the other columns
            blank).
          </li>
          <li>
            <b>part_number</b> is required; <b>name</b> is required for parts that are new. Condition is good, fair or poor.
          </li>
          <li>
            A vehicle needs <b>make</b>, <b>model</b>, <b>year_from</b> and <b>year_to</b> together. Leave <b>variant</b> blank if the part fits every
            variant.
          </li>
          <li>
            If a part already exists, the non-empty values overwrite it — <b>quantity is replaced, not added to</b>.
          </li>
          <li>Rows with errors are skipped and listed below; the other rows are still imported.</li>
        </ul>

        <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <Button type="submit" disabled={!file || busy}>
            {busy ? 'Importing…' : 'Import'}
          </Button>
        </form>
      </Card>

      <div className="mt-4 space-y-4">
        <ErrorBox>{error}</ErrorBox>

        {result && (
          <Card title="Import finished">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Tile label="Parts created" value={result.parts_created} />
              <Tile label="Parts updated" value={result.parts_updated} />
              <Tile label="Fitments added" value={result.fitments_added} />
            </div>
            {result.errors.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-red-700">
                  {result.errors.length} row{result.errors.length === 1 ? '' : 's'} skipped
                </div>
                <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr>
                        <th className={th}>Row</th>
                        <th className={th}>Problem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.errors.map((er, i) => (
                        <tr key={i}>
                          <td className={`${td} tabular-nums`}>{er.row}</td>
                          <td className={td}>{er.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  )
}

function Tile({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
