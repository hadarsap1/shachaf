// URL-scheme guards for user-contributed links (stored-XSS defense: a
// javascript:/data: URL in an <a href> executes in the clicker's session).
// Every render sink for a user-supplied URL must pass through one of these.

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:']

export function safeHref(url) {
  if (!url || typeof url !== 'string') return '#'
  try {
    const protocol = new URL(url, 'https://placeholder.invalid').protocol
    return SAFE_PROTOCOLS.includes(protocol) ? url : '#'
  } catch {
    return '#'
  }
}

// For fields users type without a scheme ("mysite.co.il") — prefix https://
// before validating, so bare domains work but javascript: still dies.
export function safeWebsiteHref(url) {
  if (!url || typeof url !== 'string') return '#'
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)
  return safeHref(hasScheme ? url : `https://${url}`)
}
