import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Minimal health check - no external imports
export async function GET(req: NextRequest) {
    const result: Record<string, any> = {
        status: 'ok',
        time: new Date().toISOString(),
        url: req.url,
    }

    // Method 1: Try process.env (sometimes works)
    try {
        result.processEnvKeys = Object.keys(process.env).slice(0, 10)
    } catch (e: any) {
        result.processEnvError = e.message
    }

    // Method 2: Try globalThis
    try {
        const globalKeys = Object.keys(globalThis).filter(k =>
            k.includes('DB') || k.includes('BUCKET') || k.includes('env')
        )
        result.globalThisKeys = globalKeys
    } catch (e: any) {
        result.globalThisError = e.message
    }

    // Method 3: Try the Cloudflare approach with proper error handling
    try {
        const cfModule = await import('@cloudflare/next-on-pages')
        result.cfModuleLoaded = true

        if (typeof cfModule.getRequestContext === 'function') {
            result.getRequestContextExists = true

            try {
                const ctx = cfModule.getRequestContext()
                result.ctxObtained = true
                result.envExists = !!ctx?.env
                result.envKeys = ctx?.env ? Object.keys(ctx.env) : []
                result.dbBinding = !!ctx?.env?.DB
                result.bucketBinding = !!ctx?.env?.BUCKET

                if (ctx?.env?.DB) {
                    const testResult = await ctx.env.DB.prepare('SELECT 1 as test').first()
                    result.dbQuery = testResult ? 'success' : 'empty'
                }
            } catch (ctxErr: any) {
                result.ctxError = ctxErr.message
                result.ctxStack = ctxErr.stack?.split('\n').slice(0, 5)
            }
        } else {
            result.getRequestContextExists = false
        }
    } catch (importErr: any) {
        result.cfModuleError = importErr.message
    }

    return NextResponse.json(result, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' }
    })
}
