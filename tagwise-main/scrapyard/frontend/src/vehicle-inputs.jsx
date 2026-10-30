import { useEffect, useId, useState } from 'react'
import { api } from './api'
import { Field, Input } from './ui'

/** Make / model / variant inputs with suggestions taken from vehicles already in the database. */
export default function VehicleInputs({ value, onChange }) {
  const id = useId()
  const [makes, setMakes] = useState([])
  const [models, setModels] = useState([])
  const [variants, setVariants] = useState([])

  useEffect(() => {
    api('/vehicles/makes').then(setMakes).catch(() => {})
  }, [])

  useEffect(() => {
    if (!value.make.trim()) {
      setModels([])
      return
    }
    let stale = false
    api('/vehicles/models', { query: { make: value.make } })
      .then((d) => !stale && setModels(d))
      .catch(() => {})
    return () => {
      stale = true
    }
  }, [value.make])

  useEffect(() => {
    if (!value.make.trim() || !value.model.trim()) {
      setVariants([])
      return
    }
    let stale = false
    api('/vehicles/variants', { query: { make: value.make, model: value.model } })
      .then((d) => !stale && setVariants(d))
      .catch(() => {})
    return () => {
      stale = true
    }
  }, [value.make, value.model])

  return (
    <>
      <Field label="Make">
        <Input
          list={`${id}-makes`}
          value={value.make}
          onChange={(e) => onChange('make', e.target.value)}
          placeholder="e.g. Hyundai"
          required
        />
        <datalist id={`${id}-makes`}>
          {makes.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Model">
        <Input
          list={`${id}-models`}
          value={value.model}
          onChange={(e) => onChange('model', e.target.value)}
          placeholder="e.g. i20"
          required
        />
        <datalist id={`${id}-models`}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
      <Field label="Variant / engine" hint="Optional">
        <Input
          list={`${id}-variants`}
          value={value.variant}
          onChange={(e) => onChange('variant', e.target.value)}
          placeholder="e.g. 1.2 Petrol"
        />
        <datalist id={`${id}-variants`}>
          {variants.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Field>
    </>
  )
}
