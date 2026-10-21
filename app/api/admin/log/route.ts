import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/api-request'

export async function POST(req: NextRequest) {
    try {
        const parsed = await readJsonBody(req)
        if (!parsed.ok) return parsed.response
        const body = parsed.body
        const { message, level, details } = body

        console.log(`[CLIENT-LOG] [${level || 'INFO'}] ${message}`, details || '')

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 500 })
    }
}
