'use client'

/**
 * Client access to the storefront data the root layout loaded on the server (lib/catalog
 * getStorefrontData): public site settings, shipping rule, max installments, categories (with counts)
 * and admin menus. Read it with these hooks instead of fetching /api/site-settings, /api/categories,
 * /api/menus or /api/shipping-settings from the browser.
 */
import * as React from 'react'
import type { Category, MenuItem, PublicSiteSettings, ShippingSettings, StorefrontData } from '@/lib/catalog'

const FALLBACK: StorefrontData = {
    settings: {
        site_name: 'Onopo',
        site_description: '',
        site_url: 'https://onopostore.com',
        logo_url: null,
        favicon_url: null,
        footer_text: '',
        footer_email: '',
        footer_phone: '',
        footer_address: '',
        footer_categories: [],
        footer_social_visible: false,
        facebook_url: '',
        instagram_url: '',
        twitter_url: '',
        youtube_url: '',
        linkedin_url: '',
        tiktok_url: '',
        whatsapp_number: '',
        header_links: [],
        maintenance_mode: false,
        products_per_page: 20,
        topbar_messages: null,
        ai_assistant_enabled: false,
        ai_whatsapp_number: '',
    },
    shipping: { freeShippingThreshold: 500, shippingCost: 100 },
    maxInstallments: null,
    categories: [],
    menus: [],
}

const StoreDataContext = React.createContext<StorefrontData | null>(null)

/** True while the root shell (LayoutProvider) renders the store header/footer itself. */
export const ShellChromeContext = React.createContext(false)

export function StoreDataProvider({ value, children }: { value: StorefrontData; children: React.ReactNode }) {
    return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>
}

/** Storefront data from the server layout; safe defaults when rendered outside the provider. */
export function useStoreData(): StorefrontData {
    return React.useContext(StoreDataContext) ?? FALLBACK
}

/** null when rendered outside the store layout (e.g. isolated previews). */
export function useOptionalStoreData(): StorefrontData | null {
    return React.useContext(StoreDataContext)
}

export function useSiteSettings(): PublicSiteSettings {
    return useStoreData().settings
}

export function useShippingSettings(): ShippingSettings {
    return useStoreData().shipping
}

export function useCategories(): Category[] {
    return useStoreData().categories
}

export function useMenus(): MenuItem[] {
    return useStoreData().menus
}

/** Whether the shell already renders the header/footer (legacy pages that render their own must not). */
export function useShellChrome(): boolean {
    return React.useContext(ShellChromeContext)
}

/**
 * Facts the trust badges need that are not part of StorefrontData. `returnDays` comes from the CMS
 * shipping page (getSiteSeo().returnPolicy.days) when the root layout passes it to LayoutProvider;
 * otherwise 14 (the statutory withdrawal period for distance sales in Turkey).
 */
export interface ShellFacts {
    returnDays: number
}

export const DEFAULT_SHELL_FACTS: ShellFacts = { returnDays: 14 }

export const ShellFactsContext = React.createContext<ShellFacts>(DEFAULT_SHELL_FACTS)

export function useShellFacts(): ShellFacts {
    return React.useContext(ShellFactsContext)
}
