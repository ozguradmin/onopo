interface AiBinding { run(model: string, inputs: unknown, options?: Record<string, unknown>): Promise<unknown> }
interface RateLimitBinding { limit(options: { key: string }): Promise<{ success: boolean }> }
// Cloudflare Images binding (wrangler.toml [images]); only the optimization chain is used (lib/image-variants-auto.ts)
interface ImagesTransformChain {
    transform(options: Record<string, unknown>): ImagesTransformChain
    output(options: { format: string; quality?: number }): Promise<{ response(): Response }>
}
interface ImagesBindingLite { input(stream: ReadableStream<Uint8Array>): ImagesTransformChain }
interface CloudflareEnv {
    DB: D1Database;
    BUCKET: R2Bucket;
    AI?: AiBinding;
    IMAGES?: ImagesBindingLite;
    CHAT_RL_BURST?: RateLimitBinding;
    CHAT_RL_MIN?: RateLimitBinding;
    CHAT_RL_MODEL?: RateLimitBinding;
    AI_CHAT_MODEL?: string;
    AI_ROUTER_MODEL?: string;
    AI_FALLBACK_MODEL?: string;
    AI_GATEWAY_ID?: string;
}
