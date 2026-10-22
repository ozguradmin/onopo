// Shared by /api/site-settings (admin view on the same URL) and /api/site-settings/public (cacheable).

// Settings that only the admin panel may read (e.g. where 2FA codes and order notifications go,
// and when the last admin password-reset mail was sent by /api/admin/forgot-password), plus the
// Onopo Asistan configuration (Admin › AI Asistan; the chat API reads them on the server). Its WhatsApp
// number, ai_whatsapp_number, stays public: the chat UI needs it for the WhatsApp cards it builds itself; so
// does ai_popular_questions (the chips of the empty chat). When and how those chips were set
// (ai_popular_questions_meta) is admin-only.
export const ADMIN_ONLY_KEYS = new Set([
    'admin_email', 'admin_reset_last_sent',
    'ai_daily_budget_usd', 'ai_ship_days', 'ai_ship_cutoff', 'ai_support_hours', 'ai_campaigns',
    'ai_popular_questions_meta',
    // Review-request e-mails on/off (Admin › Yorumlar, lib/order-reviews.ts)
    'review_requests_enabled',
])

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
