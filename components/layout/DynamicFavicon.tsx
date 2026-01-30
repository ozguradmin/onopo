'use client'

import * as React from 'react'

export function DynamicFavicon() {
    React.useEffect(() => {
        // Fetch site settings and update favicon dynamically
        fetch('/api/site-settings')
            .then(res => res.ok ? res.json() : null)
            .then(settings => {
                if (settings?.favicon_url) {
                    // Update favicon links
                    const existingIcons = document.querySelectorAll('link[rel="icon"]')
                    existingIcons.forEach(icon => icon.remove())

                    // Add new favicon
                    const link = document.createElement('link')
                    link.rel = 'icon'
                    link.type = 'image/png'
                    link.href = settings.favicon_url
                    document.head.appendChild(link)

                    // Also update apple-touch-icon if present
                    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
                    if (appleIcon) {
                        appleIcon.setAttribute('href', settings.favicon_url)
                    }
                }
            })
            .catch(() => { })
    }, [])

    return null
}
