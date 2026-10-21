'use client'

/**
 * UI state of the store shell that several islands share: the mobile menu drawer and the mobile
 * search sheet (the cart drawer keeps its own `isOpen` in store/cart-store.ts). The bottom nav hides
 * while any of them is open.
 */
import { create } from 'zustand'

interface ShellUIState {
    menuOpen: boolean
    searchOpen: boolean
    openMenu: () => void
    closeMenu: () => void
    setSearchOpen: (open: boolean) => void
}

export const useShellUI = create<ShellUIState>()(set => ({
    menuOpen: false,
    searchOpen: false,
    openMenu: () => set({ menuOpen: true, searchOpen: false }),
    closeMenu: () => set({ menuOpen: false }),
    setSearchOpen: open => set({ searchOpen: open }),
}))

/*
 * Opening the mobile search must focus its input synchronously inside the tap handler, otherwise
 * iOS does not show the keyboard. The mobile search box registers a function that does exactly
 * that; the bottom nav "Ara" button calls it.
 */
let mobileSearchOpener: (() => void) | null = null

export function registerMobileSearch(open: () => void): () => void {
    mobileSearchOpener = open
    return () => {
        if (mobileSearchOpener === open) mobileSearchOpener = null
    }
}

/** Focus the mobile search box (opens the full-screen search sheet). Returns false if unavailable. */
export function openMobileSearch(): boolean {
    if (!mobileSearchOpener) return false
    mobileSearchOpener()
    return true
}
