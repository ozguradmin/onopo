import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function GET(req: NextRequest, props: { params: Promise<{ key: string }> }) {
    try {
        const params = await props.params
        const key = params.key
        const bucket = getRequestContext().env.BUCKET

        const object = await bucket.get(key)

        if (!object) {
            return new NextResponse('Image not found', { status: 404 })
        }

        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)

        return new NextResponse(object.body, {
            headers,
        })

    } catch (error: any) {
        return new NextResponse('Error fetching image', { status: 500 })
    }
}
