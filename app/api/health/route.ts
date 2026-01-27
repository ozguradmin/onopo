import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Ultra-simple health check that won't crash
export async function GET(req: NextRequest) {
    const result: Record<string, any> = {
        status: 'ok',
        time: new Date().toISOString(),
    }

    try {
        // Try to import and get context
        const { getRequestContext } = await import('@cloudflare/next-on-pages')
        const ctx = getRequestContext()

        result.hasCtx = !!ctx
        result.hasEnv = !!ctx?.env

        if (ctx?.env) {
            result.envKeys = Object.keys(ctx.env)
            result.hasDB = !!ctx.env.DB
            result.hasBucket = !!ctx.env.BUCKET

            // Try DB query only if DB exists
            if (ctx.env.DB) {
                try {
                    const res = await ctx.env.DB.prepare('SELECT 1 as x').first()
                    result.dbTest = res ? 'success' : 'empty'
                } catch (dbErr: any) {
                    result.dbTest = 'error'
                    result.dbError = dbErr.message
                }
            }
        }
    } catch (err: any) {
        result.error = err.message
        result.stack = err.stack?.split('\n').slice(0, 3)
    }

    return NextResponse.json(result)
}
