// Post-login ?redirect= targets must stay on this site: only same-origin relative paths are accepted
// (no absolute URLs, protocol-relative '//host', backslash tricks or javascript: URLs).
const PARSE_BASE = 'https://onopostore.invalid'

export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
    // Browsers treat '\' like '/' and drop tabs/newlines, which can turn '/\evil.com' into '//evil.com'
    if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return fallback
    try {
        const url = new URL(value, PARSE_BASE)
        const path = `${url.pathname}${url.search}${url.hash}`
        // '/..//host' normalises to '//host', which a browser would read as another site
        if (url.origin !== PARSE_BASE || path.startsWith('//')) return fallback
        return path
    } catch {
        return fallback
    }
}
