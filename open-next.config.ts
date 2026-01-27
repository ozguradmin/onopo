import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
    default: {
        // Enable incremental static regeneration
        incrementalCache: "cache",
        // Enable tag cache for on-demand revalidation  
        tagCache: "cache",
    },
};

export default config;
