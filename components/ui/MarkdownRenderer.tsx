// Helper to decode common HTML entities (repeated here for safety or can be exported)
function decodeHtmlEntities(text: string): string {
    const entities: { [key: string]: string } = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
        '&nbsp;': ' ', '&ouml;': 'ö', '&Ouml;': 'Ö', '&ccedil;': 'ç', '&Ccedil;': 'Ç',
        '&ş': 'ş', '&Ş': 'Ş', '&ı': 'ı', '&İ': 'İ', '&ğ': 'ğ', '&Ğ': 'Ğ',
        '&uuml;': 'ü', '&Uuml;': 'Ü', '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"',
        '&ldquo;': '"', '&ndash;': '-', '&mdash;': '—'
    }
    return text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match)
}

export function MarkdownRenderer({ content }: { content: string }) {
    if (!content) return null

    // Decode and split
    const decodedContent = decodeHtmlEntities(content)
    const normalizedContent = decodedContent.replace(/\r\n/g, '\n')
    const lines = normalizedContent.split('\n')

    return (
        <div className="space-y-4 text-slate-600 leading-relaxed text-base">
            {lines.map((line, index) => {
                let trimmedLine = line.trim()

                // Remove literal tags
                trimmedLine = trimmedLine.replace(/<[^>]*>?/gm, '')

                // Skip if truly empty or just a stray bullet
                if (!trimmedLine || trimmedLine === '-' || trimmedLine === '*' || trimmedLine === '•') {
                    if (line.trim() === '') return <div key={index} className="h-1" />
                    return null
                }

                // Headings
                if (trimmedLine.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-bold text-slate-900 mt-6 mb-2">{trimmedLine.replace('### ', '')}</h3>
                }
                if (trimmedLine.startsWith('## ')) {
                    return <h2 key={index} className="text-xl font-bold text-slate-900 mt-8 mb-4 border-b border-slate-100 pb-2 block w-full">{trimmedLine.replace('## ', '')}</h2>
                }
                if (trimmedLine.startsWith('# ')) {
                    return <h1 key={index} className="text-2xl font-bold text-slate-900 mt-10 mb-6">{trimmedLine.replace('# ', '')}</h1>
                }

                // List items
                if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                    const text = trimmedLine.replace(/^[*|-]\s*/, '')
                    if (!text.trim()) return null
                    return (
                        <div key={index} className="flex gap-2 ml-4 my-1">
                            <span className="text-slate-900 mt-1.5 font-bold text-xs">•</span>
                            <span className="flex-1">{parseBold(text)}</span>
                        </div>
                    )
                }

                // Regular text (with bold support)
                return (
                    <p key={index} className="min-h-[1.5em] mb-2 last:mb-0">
                        {parseBold(trimmedLine)}
                    </p>
                )
            })}
        </div>
    )
}

// Helper to parse **bold** text
function parseBold(text: string) {
    if (!text) return ""
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2).trim()
            if (!boldText) return null
            return <strong key={i} className="font-semibold text-slate-900">{boldText}</strong>
        }
        return part
    })
}

