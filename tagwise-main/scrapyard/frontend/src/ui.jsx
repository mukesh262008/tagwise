import { useEffect } from 'react'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50'
const buttonVariants = {
  primary: 'bg-amber-600 text-white hover:bg-amber-700',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'text-slate-600 shadow-none hover:bg-slate-100',
}

export function Button({ variant = 'primary', type = 'button', className, ...props }) {
  return <button type={type} {...props} className={cx(buttonBase, buttonVariants[variant], className)} />
}

const fieldClass =
  'block w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-600'

export function Field({ label, hint, className, children }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Input({ className, ...props }) {
  return <input {...props} className={cx(fieldClass, className)} />
}

export function Select({ className, children, ...props }) {
  return (
    <select {...props} className={cx(fieldClass, className)}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }) {
  return <textarea {...props} className={cx(fieldClass, className)} />
}

export function Card({ title, action, className, children }) {
  return (
    <section className={cx('rounded-xl bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

const tones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

export function Badge({ tone = 'slate', children }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function StockBadge({ quantity }) {
  if (quantity <= 0) return <Badge tone="red">Out of stock</Badge>
  if (quantity <= 2) return <Badge tone="amber">Low · {quantity}</Badge>
  return <Badge tone="green">{quantity} in stock</Badge>
}

const conditionTone = { good: 'green', fair: 'amber', poor: 'red' }

export function ConditionBadge({ condition }) {
  return <Badge tone={conditionTone[condition] ?? 'slate'}>{condition}</Badge>
}

export function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-600/20">
      {children}
    </div>
  )
}

export function Spinner() {
  return <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
}

export function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx(
          'max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const th = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
export const td = 'px-4 py-3 text-sm text-slate-700'
