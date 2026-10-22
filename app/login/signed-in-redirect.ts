import 'server-only'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/account'
import { safeRedirectPath } from '@/lib/safeRedirect'

type SearchParams = Record<string, string | string[] | undefined>

/** /login and /register themselves are never a target: that would send the visitor in a circle. */
const AUTH_PAGE = /^\/(login|register)(\/|\?|#|$)/i

/**
 * Server-side guard of /login/ and /register/: a visitor who is already signed in (valid auth_token for
 * an existing user, same check as /profile/) is redirected instead of seeing the forms again.
 * Target: the ?redirect= path when it is a same-origin path (lib/safeRedirect.ts), otherwise /profile/.
 * Admins keep the login page's own default ('/', where it sends them after signing in); they still go
 * to a valid ?redirect= target such as /admin/. Guests get the page as before.
 */
export async function redirectIfSignedIn(searchParams: SearchParams): Promise<void> {
    const user = await getSessionUser()
    if (!user) return
    const raw = searchParams.redirect
    const target = safeRedirectPath(Array.isArray(raw) ? raw[0] : raw, '')
    redirect(target && !AUTH_PAGE.test(target) ? target : user.role === 'admin' ? '/' : '/profile/')
}
