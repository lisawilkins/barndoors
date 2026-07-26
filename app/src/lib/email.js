// Deliberately stricter than the HTML5 email spec: excludes characters like
// "?", "&", quotes, and whitespace/control characters that are technically
// legal in an email local-part but would let a malicious value hijack a
// `mailto:` link (e.g. "victim@example.com?bcc=attacker@evil.com") if built
// directly from stored data. Real-world addresses essentially never need
// those characters.
const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function sanitizeEmail(value) {
  return (value ?? '').replace(/[\r\n\t]/g, '').trim()
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value ?? '')
}
