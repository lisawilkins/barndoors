// Formats a US-style phone number as "(###) ###-####" for display, and
// builds a matching "tel:" link using the raw digits (so the OS dialer gets
// something unambiguous regardless of how the number was typed/stored).
export function formatPhone(phone) {
  if (!phone) return ''

  const digits = phone.replace(/\D/g, '')

  // 11 digits with a leading "1" is a US number with country code — format
  // the last 10 and drop the prefix rather than showing it as an area code.
  const tenDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits

  if (tenDigits.length !== 10) return phone

  return `(${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`
}

export function telHref(phone) {
  if (!phone) return ''
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
