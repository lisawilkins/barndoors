const labelClass = 'text-xs font-semibold text-ink-400'
const controlClass =
  'rounded-md border border-border-input bg-surface-input px-4 text-[15px] text-ink-900'

export function TextField({ label, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <input {...props} className={`h-14 w-full min-w-0 ${controlClass}`} />
    </label>
  )
}

export function TextAreaField({ label, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <textarea {...props} rows={3} className={`w-full min-w-0 ${controlClass} py-3`} />
    </label>
  )
}

export function SelectField({ label, children, className = '', ...props }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <select {...props} className={`h-14 w-full min-w-0 ${controlClass}`}>
        {children}
      </select>
    </label>
  )
}
