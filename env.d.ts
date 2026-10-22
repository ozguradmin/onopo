interface AiBinding { run(model: string, inputs: unknown, options?: Record<string, unknown>): Promise<unknown> }
interface RateLimitBinding { limit(options: { key: string }): Promise<{ success: boolean }> }
interface CloudflareEnv {
    DB: D1Database;
    BUCKET: R2Bucket;
    AI?: AiBinding;
    CHAT_RL_BURST?: RateLimitBinding;
    CHAT_RL_MIN?: RateLimitBinding;
    CHAT_RL_MODEL?: RateLimitBinding;
    AI_CHAT_MODEL?: string;
    AI_ROUTER_MODEL?: string;
    AI_FALLBACK_MODEL?: string;
    AI_GATEWAY_ID?: string;
}
