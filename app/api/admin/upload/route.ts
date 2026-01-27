import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'

// We need to access the Binding from the Request Context
import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        const buffer = await file.arrayBuffer()
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`

        // Put to R2
        const bucket = getRequestContext().env.BUCKET
        await bucket.put(filename, buffer, {
            httpMetadata: {
                contentType: file.type,
            }
        })

        // Return the proxy URL
        const url = `/api/images/${filename}`

        return NextResponse.json({ success: true, url })

    } catch (error: any) {
        console.error("Upload error", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
