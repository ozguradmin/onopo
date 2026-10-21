import * as React from 'react'

/**
 * Renders a JSON-LD <script>. Escapes "<" so product names or descriptions can never close the tag.
 * Server-friendly; place it anywhere in a page (Google reads JSON-LD from the body too).
 */
export function JsonLd({ data, id }: { data: unknown; id?: string }) {
    const json = JSON.stringify(data).replace(/</g, '\\u003c')
    return <script type="application/ld+json" id={id} dangerouslySetInnerHTML={{ __html: json }} />
}

export default JsonLd
