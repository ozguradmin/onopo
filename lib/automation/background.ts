/**
 * Work that runs after the admin's request has been answered (ctx.waitUntil): rewriting a product's assistant
 * facts line after a save, making the WebP variants of a fresh upload. The admin never waits for it and it can
 * never fail the save; its own failures go to the system log (lib/system-log.ts).
 *
 * waitUntil keeps the Worker alive for about 30 s after the response, so tasks are sized for that.
 */
import 'server-only'
import { logSystemEvent, type SystemLogSource } from '@/lib/system-log'

/** Registers `task` with ctx.waitUntil. Never throws; without a Cloudflare context (next dev) it does nothing. */
export async function runInBackground(source: SystemLogSource, task: (env: CloudflareEnv) => Promise<unknown>): Promise<void> {
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env, ctx } = await getCloudflareContext({ async: true })
        const work = (async () => {
            try {
                await task(env)
            } catch (err) {
                await logSystemEvent(env.DB, {
                    source,
                    level: 'error',
                    message: 'Arka plan işi beklenmedik şekilde durdu.',
                    detail: err instanceof Error ? err.message : 'error',
                })
            }
        })()
        ctx.waitUntil(work)
    } catch (err) {
        console.error('background_task_not_scheduled', source, err instanceof Error ? err.message : 'error')
    }
}
