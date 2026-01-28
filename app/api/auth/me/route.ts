import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'



export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('token')

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const payload = await verifyJWT(token.value)

        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        return NextResponse.json({
            user: {
                id: payload.id,
                email: payload.email,
                role: payload.role,
                fullName: payload.fullName
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
