/**
 * Turkish phone number check of the checkout (app/odeme), pure so scripts/analytics.test.mjs can test it.
 * First removes what people paste or type around the digits: invisible format characters (the bidi
 * marks iOS Contacts adds, zero-width spaces), whitespace, parentheses, dots, slashes and dashes.
 * Then: 10 digits starting with 5 (mobile), 2–4 (landline) or 8 (0850 / 0800 / 0888 business and
 * toll-free numbers, which some companies order with), optionally after a country code (+90, 90 or
 * 0090) and/or a trunk 0. Every accepted value has at least 10 digits, so the order API's own lenient
 * check (app/api/orders/route.ts: at least 10 digits) accepts it too.
 */
export const TURKISH_PHONE = /^(?:\+?90|0090)?0?[2-58]\d{9}$/

export function isValidTurkishPhone(value: string): boolean {
    const compact = String(value ?? '').replace(/[\p{Cf}\s().\/\p{Pd}]/gu, '')
    return TURKISH_PHONE.test(compact)
}
