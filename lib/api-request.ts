// Small helpers for API route handlers.
import { NextResponse } from 'next/server'

export const INVALID_JSON_MESSAGE = 'Geçersiz istek: gövde geçerli bir JSON nesnesi olmalı.'

/**
 * Reads a JSON object body. A malformed or non-object body (invalid JSON, null, an array, a number)
 * gives a ready 400 response instead of an exception that would end up as a 500.
 *
 *   const parsed = await readJsonBody(req)
 *   if (!parsed.ok) return parsed.response
 *   const { email } = parsed.body
 */
export async function readJsonBody(req: Request): Promise<{ ok: true, body: any } | { ok: false, response: NextResponse }> {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return { ok: false, response: NextResponse.json({ error: INVALID_JSON_MESSAGE }, { status: 400 }) }
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return { ok: false, response: NextResponse.json({ error: INVALID_JSON_MESSAGE }, { status: 400 }) }
    }
    return { ok: true, body }
}

/**
 * Answer for GET on an endpoint that changes data (migrations, repairs, seeding). Those run only on an
 * admin POST, so a link, an <img> or a prefetch can never trigger them.
 */
export function postOnly(): NextResponse {
    return NextResponse.json(
        { error: 'Bu işlem yalnızca yönetici oturumuyla POST isteği olarak çalıştırılabilir.' },
        { status: 405, headers: { Allow: 'POST' } }
    )
}
