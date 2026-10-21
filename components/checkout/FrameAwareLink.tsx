'use client'

import * as React from 'react'
import Link from 'next/link'

/**
 * Link for the PayTR result pages (/siparis-basarili/, /siparis-hata/). PayTR opens them INSIDE its
 * iframe on /odeme/; there a normal link would load the whole store inside the iframe. When the page
 * is framed, the link targets the top window instead. Standalone it is a normal client-side Link.
 */
export function FrameAwareLink(props: React.ComponentProps<typeof Link>) {
    const [framed, setFramed] = React.useState(false)
    React.useEffect(() => {
        try {
            setFramed(window.self !== window.top)
        } catch {
            setFramed(true)
        }
    }, [])
    return <Link {...props} target={framed ? '_top' : props.target} />
}
