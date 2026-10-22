/**
 * URL slugs of the shopping guides (/rehber/<slug>/), in hub order. Kept apart from the guide texts so that
 * lib/redirects.ts (bundled into worker.ts) knows the live guide URLs without carrying the articles.
 * scripts/guides.test.mjs checks that this list and GUIDES (lib/guides/index.ts) are the same.
 */
export const GUIDE_SLUGS = [
    'iphone-sarj-aleti-ve-kablo-secimi',
    'hizli-sarj-nedir-pd-watt-amper',
    'ekran-koruyucu-secimi-9d-12d-seramik',
    'tablet-ekran-koruyucu-model-kodu-bulma',
    'arac-sarj-cihazi-nasil-secilir',
    'powerbank-secimi-mah-ve-cikis-gucu',
] as const

export type GuideSlug = (typeof GUIDE_SLUGS)[number]

/** The guides hub. */
export const GUIDES_PATH = '/rehber/'

/** Canonical path of a guide: /rehber/<slug>/ (trailing slash, like every storefront URL). */
export function guidePath(slug: string): string {
    return `${GUIDES_PATH}${slug}/`
}

const SLUG_SET: ReadonlySet<string> = new Set(GUIDE_SLUGS)

export function isGuideSlug(slug: string): slug is GuideSlug {
    return SLUG_SET.has(slug)
}
