// OpenNext uses getCloudflareContext from @opennextjs/cloudflare
// This provides access to Cloudflare bindings like D1, R2, KV etc.

export const runtime = 'edge'

export async function getDB() {
    // Import dynamically to avoid build-time issues
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()

    if (!env?.DB) {
        throw new Error('Database binding not found')
    }

    return env.DB
}

export async function getBucket() {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()

    if (!env?.BUCKET) {
        throw new Error('R2 bucket binding not found')
    }

    return env.BUCKET
}
