import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { message, level, details } = body

        console.log(`[CLIENT-LOG] [${level || 'INFO'}] ${message}`, details || '')

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ success: false }, { status: 500 })
    }
}
