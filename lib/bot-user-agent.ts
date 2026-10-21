// User agents that are not page views: crawlers, link previewers, uptime checkers and HTTP libraries.
//
// "bot" only counts as a crawler token when it ends a word (Googlebot/2.1, bingbot/2.0, AhrefsBot/7.0,
// Twitterbot, DuckDuckBot-Https, PetalBot;) and is not the CUBOT phone brand ("Android 10; CUBOT X30"),
// whose user agents used to be dropped by a plain /bot/i.
export const BOT_USER_AGENT = /(?<! cu)bot(?:[^a-z0-9]|$)|crawl|spider|slurp|facebookexternalhit|embedly|preview|headless|lighthouse|pagespeed|curl|wget|python|go-http|java\/|okhttp|axios|node-fetch|undici|httpclient|libwww|monitor|uptime/i

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
    return !userAgent || BOT_USER_AGENT.test(userAgent)
}
