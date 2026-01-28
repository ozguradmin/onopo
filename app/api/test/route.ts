// Absolutely minimal test - no imports except Next.js


export async function GET() {
    return new Response(JSON.stringify({
        test: 'ok',
        time: Date.now()
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })
}
