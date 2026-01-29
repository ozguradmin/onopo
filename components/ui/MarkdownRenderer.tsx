import React from 'react'

export function MarkdownRenderer({ content }: { content: string }) {
    if (!content) return null

    // Split by new lines
    const lines = content.split('\n')

    return (
        <div className="space-y-2 text-slate-600 leading-relaxed">
            {lines.map((line, index) => {
                // Headings
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="text-lg font-bold text-slate-900 mt-4 mb-2">{line.replace('### ', '')}</h3>
                }
                if (line.startsWith('## ')) {
                    return <h2 key={index} className="text-xl font-bold text-slate-900 mt-6 mb-3 border-b border-slate-100 pb-2">{line.replace('## ', '')}</h2>
                }
                if (line.startsWith('# ')) {
                    return <h1 key={index} className="text-2xl font-bold text-slate-900 mt-8 mb-4">{line.replace('# ', '')}</h1>
                }

                // List items
                if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                    const text = line.trim().substring(2)
                    // Check for bold inside list
                    return (
                        <div key={index} className="flex gap-2 ml-4">
                            <span className="text-slate-900 mt-1.5">•</span>
                            <span>{parseBold(text)}</span>
                        </div>
                    )
                }

                // Empty lines
                if (line.trim() === '') {
                    return <br key={index} />
                }

                // Regular text (with bold support)
                return (
                    <p key={index} className="min-h-[1em]">
                        {parseBold(line)}
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
