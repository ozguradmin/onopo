import React from 'react'

export function MarkdownRenderer({ content }: { content: string }) {
    if (!content) return null

    // Split by new lines for markdown parsing
    // Normalize newlines and split
    const normalizedContent = content.replace(/\r\n/g, '\n')
    const lines = normalizedContent.split('\n')

    return (
        <div className="space-y-4 text-slate-600 leading-relaxed text-base">
            {lines.map((line, index) => {
                let trimmedLine = line.trim()

                // Final safety: Remove any literal HTML tags if they survived preprocessing
                trimmedLine = trimmedLine.replace(/<[^>]*>?/gm, '')
                if (!trimmedLine && line.trim() !== '') return null // Skip if line was just HTML

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
                    const text = trimmedLine.replace(/^[*|-]\s?/, '')
                    return (
                        <div key={index} className="flex gap-2 ml-4 my-1">
                            <span className="text-slate-900 mt-1.5 font-bold">•</span>
                            <span className="flex-1">{parseBold(text)}</span>
                        </div>
                    )
                }

                // Empty lines
                if (trimmedLine === '') {
                    return <div key={index} className="h-2" />
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
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
        }
        return part
    })
}
