// A readable (non-HttpOnly) companion of the HttpOnly auth_token cookie. worker.ts keeps it in sync on
// every request: set while auth_token is present, cleared when it is gone. Client code uses it only as a
// hint ("this visitor may be logged in") to skip pointless API calls; it is never trusted for access.
export const SESSION_HINT_COOKIE = 'onopo_oturum'

export function hasSessionHint(): boolean {
    if (typeof document === 'undefined') return false
    return /(?:^|;\s*)onopo_oturum=1(?:;|$)/.test(document.cookie)
}
