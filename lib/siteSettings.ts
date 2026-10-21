// Shared by /api/site-settings (admin view on the same URL) and /api/site-settings/public (cacheable).

// Settings that only the admin panel may read (e.g. where 2FA codes and order notifications go)
export const ADMIN_ONLY_KEYS = new Set(['admin_email'])

// Internal bookkeeping rows that no client needs (cache_version is the edge-cache version, see worker.ts)
export const INTERNAL_KEYS = new Set(['cache_version'])

export function settingsObject(rows: Array<{ key: string, value: string }>, isAdmin: boolean): Record<string, string> {
    const settings: Record<string, string> = {}
    for (const row of rows) {
        if (INTERNAL_KEYS.has(row.key)) continue
        if (!isAdmin && ADMIN_ONLY_KEYS.has(row.key)) continue
        settings[row.key] = row.value
    }
    return settings
}
