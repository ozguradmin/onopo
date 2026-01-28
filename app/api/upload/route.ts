import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // In a real Cloudflare setup, you would upload to R2 here.
        // For this demo/dev environment, we will return a Base64 string so it works immediately without external storage bucket.
        // Warning: This increases payload size, but is fine for small/medium images in a demo.

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        const dataUrl = `data:${file.type};base64,${base64}`

        return NextResponse.json({
            success: true,
            url: dataUrl
        })

    } catch (error: any) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
