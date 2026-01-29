
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()

        // Check if columns exist, if not add them
        try {
            await db.prepare("ALTER TABLE coupons ADD COLUMN type TEXT DEFAULT 'global'").run()
            console.log("Added type column")
        } catch (e: any) {
            if (!e.message.includes('duplicate column')) console.log("Type column likely exists")
        }

        try {
            await db.prepare("ALTER TABLE coupons ADD COLUMN target_ids TEXT DEFAULT ''").run()
            console.log("Added target_ids column")
        } catch (e: any) {
            if (!e.message.includes('duplicate column')) console.log("Target_ids column likely exists")
        }

        return NextResponse.json({ success: true, message: "Migration applied" })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
