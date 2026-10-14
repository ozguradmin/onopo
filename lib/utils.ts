import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Convert image URL to R2 custom domain URL
 * Uses images.onopostore.com which is connected directly to R2 bucket
 * This bypasses the worker entirely = 0 CPU usage
 */
const R2_CUSTOM_DOMAIN = 'https://images.onopostore.com'

export function getImageUrl(url: string | undefined | null): string {
    if (!url) return '/placeholder.svg'

    // Already a full external URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
        // If it's an old R2 public URL, convert to custom domain
        if (url.includes('.r2.dev/')) {
            const key = url.split('.r2.dev/')[1]
            if (key) return `${R2_CUSTOM_DOMAIN}/${key}`
        }
        return url
    }

    // /api/images/xxx.png -> convert to custom domain
    if (url.startsWith('/api/images/')) {
        const key = url.replace('/api/images/', '')
        return `${R2_CUSTOM_DOMAIN}/${key}`
    }

    // Just a filename like "xxx.png" -> custom domain
    if (!url.startsWith('/')) {
        return `${R2_CUSTOM_DOMAIN}/${url}`
    }

    // Other paths (like /placeholder.svg)
    return url
}

/**
 * Parse product images from raw string or array
 * Used to handle API response where images come as raw JSON string
 * This distributes CPU load from server to client browsers
 */
export function parseProductImages(images: string | string[] | undefined | null): string[] {
    if (!images) return []
    if (Array.isArray(images)) return images
    if (typeof images === 'string') {
        try {
            const parsed = JSON.parse(images)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }
    return []
}
