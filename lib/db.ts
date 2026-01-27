import { NextRequest } from 'next/server';

// Helper to get D1 database from request context or creating a dummy for build time if needed
// In Next.js on Pages, we might need to rely on 'getRequestContext' from @cloudflare/next-on-pages
import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export function getDB() {
    try {
        const db = getRequestContext().env.DB;
        if (!db) {
            throw new Error('Database binding not found');
        }
        return db;
    } catch (e) {
        console.error("Failed to get DB binding", e);
        throw e;
    }
}
