import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_HINT_COOKIE } from '@/lib/session-hint'

export async function POST() {
    const cookieStore = await cookies()
    cookieStore.delete('auth_token')
    // The readable session hint goes with it (worker.ts would clear it on the next request anyway)
    cookieStore.set(SESSION_HINT_COOKIE, '', { httpOnly: false, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
    return NextResponse.json({ success: true })
}
