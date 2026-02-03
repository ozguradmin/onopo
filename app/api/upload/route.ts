import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Get Cloudflare context for R2 access
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext()
        const bucket = env.BUCKET

        if (!bucket) {
            console.error('R2 Bucket binding not found')
            return NextResponse.json({ error: 'Storage configuration error' }, { status: 500 })
        }

        // Create unique filename
        const ext = file.name.split('.').pop()
        // Generate random string (replacement for uuid)
        const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const key = `${Date.now()}-${randomId}.${ext}`

        // Upload to R2
        const buffer = await file.arrayBuffer()
        await bucket.put(key, buffer, {
            httpMetadata: {
                contentType: file.type,
            },
        })

        // Return public R2 URL directly (to bypass /api/images/ proxy)
        // Hardcoded for now based on lib/utils.ts, ideally env var
        const R2_PUBLIC_URL = 'https://pub-84a4a4a7d990439cbfeb17aaa4c7677c.r2.dev'
        const url = `${R2_PUBLIC_URL}/${key}`

        return NextResponse.json({
            success: true,
            url: url,
            key: key
        })

    } catch (error: any) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
