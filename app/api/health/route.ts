import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Health check endpoint that doesn't require DB
// This helps diagnose if the issue is with the deployment or the DB binding
export async function GET(req: NextRequest) {
    const diagnostics: Record<string, any> = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        runtime: 'edge',
        environment: process.env.NODE_ENV,
    }

    // Try to access the Cloudflare context
    try {
        const { getRequestContext } = await import('@cloudflare/next-on-pages')
        const ctx = getRequestContext()

        diagnostics.hasEnv = !!ctx?.env
        diagnostics.hasDB = !!ctx?.env?.DB
        diagnostics.hasBucket = !!ctx?.env?.BUCKET
        diagnostics.envKeys = ctx?.env ? Object.keys(ctx.env) : []

        // If DB exists, try a simple query
        if (ctx?.env?.DB) {
            try {
                const result = await ctx.env.DB.prepare('SELECT 1 as test').first()
                diagnostics.dbConnection = 'success'
                diagnostics.dbTestResult = result
            } catch (dbError: any) {
                diagnostics.dbConnection = 'failed'
                diagnostics.dbError = dbError.message
            }
        }
    } catch (error: any) {
        diagnostics.contextError = error.message
    }

    return NextResponse.json(diagnostics, { status: 200 })
}
