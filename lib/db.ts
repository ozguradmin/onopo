// OpenNext uses getCloudflareContext from @opennextjs/cloudflare
// This provides access to Cloudflare bindings like D1, R2, KV etc.

export const runtime = 'edge'

try {
    // Import dynamically to avoid build-time issues
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()

    if (!env?.DB) {
        console.error('DATABASE ERROR: Binding DB not found in environment.')
        throw new Error('Database binding not found')
    }

    return env.DB
} catch (err) {
    console.error('getDB FAILED:', err)
    throw err
}
}

export async function getBucket() {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext()

    if (!env?.BUCKET) {
        throw new Error('R2 bucket binding not found')
    }

    return env.BUCKET
}
