const labelClass = 'text-lg font-medium text-gray-700'
const controlClass = 'rounded-lg border border-gray-300 px-4 text-lg text-gray-900'

export function TextField({ label, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <input {...props} className={`h-14 ${controlClass}`} />
    </label>
  )
}

export function TextAreaField({ label, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <textarea {...props} rows={3} className={`${controlClass} py-3`} />
    </label>
  )
}

export function SelectField({ label, children, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelClass}>{label}</span>
      <select {...props} className={`h-14 ${controlClass}`}>
        {children}
      </select>
    </label>
  )
}
