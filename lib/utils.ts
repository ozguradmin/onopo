import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// R2 Public bucket URL - bypass /api/images/ to save CPU
const R2_PUBLIC_URL = 'https://pub-84a4a4a7d990439cbfeb17aaa4c7677c.r2.dev'

/**
 * Convert image URL to direct R2 URL to bypass Worker
 * /api/images/xxx.png -> https://r2.dev/xxx.png
 */
export function getImageUrl(url: string | undefined | null): string {
    if (!url) return '/placeholder.svg'

    // Already a full URL (R2 or external)
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
    }

    // /api/images/xxx.png -> xxx.png -> R2 URL
    if (url.startsWith('/api/images/')) {
        const key = url.replace('/api/images/', '')
        return `${R2_PUBLIC_URL}/${key}`
    }

    // Just a filename like "xxx.png" -> R2 URL
    if (!url.startsWith('/')) {
        return `${R2_PUBLIC_URL}/${url}`
    }

    // Other paths (like /placeholder.svg)
    return url
}
