"use client"

import { useState, useEffect } from "react"
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer"

// Helper to decode common HTML entities (Moved from ProductClient to be isolated)
function decodeHtmlEntities(text: string): string {
    const entities: { [key: string]: string } = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
        '&nbsp;': ' ', '&ouml;': 'ö', '&Ouml;': 'Ö', '&ccedil;': 'ç', '&Ccedil;': 'Ç',
        '&ş': 'ş', '&Ş': 'Ş', '&ı': 'ı', '&İ': 'İ', '&ğ': 'ğ', '&Ğ': 'Ğ',
        '&uuml;': 'ü', '&Uuml;': 'Ü', '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"',
        '&ldquo;': '"', '&ndash;': '-', '&mdash;': '—', '&bull;': '•', '&middot;': '·',
        '&euro;': '€', '&copy;': '©', '&reg;': '®', '&le;': '≤', '&ge;': '≥'
    }
    return text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match)
}

// Helper to format messy description text
function preprocessDescription(text: string): string {
    if (!text) return ""

    // 1. Decode entities first
    let formatted = decodeHtmlEntities(text)

    // 2. Strip literal HTML tags displayed as text
    formatted = formatted.replace(/<div[^>]*>/gi, '')
    formatted = formatted.replace(/<\/div>/gi, '\n')
    formatted = formatted.replace(/<p[^>]*>/gi, '\n')
    formatted = formatted.replace(/<\/p>/gi, '\n')
    formatted = formatted.replace(/<br\s*\/?>/gi, '\n')
    formatted = formatted.replace(/<span[^>]*>/gi, '')
    formatted = formatted.replace(/<\/span>/gi, '')

    // 3. AGGRESSIVE Section Header Splitting
    const sectionHeaders = [
        "Ürün Açıklaması",
        "Detaylı Bilgi",
        "Teknik Özellikler",
        "Kutu İçeriği",
        "Ürün Özellikleri",
        "Özellikler"
    ]
    sectionHeaders.forEach(section => {
        const regex = new RegExp(`(${section})`, 'gi')
        formatted = formatted.replace(regex, '\n\n## $1\n\n')
    })

    // 4. AGGRESSIVE Key-Value Splitting for Teknik Özellikler
    const techKeys = [
        { key: "Marka", pattern: /Marka([A-Za-zğüşıöçĞÜŞİÖÇ\s]+?)(?=Ürün Kodu|Barkod|Desi|Varyant|$|\n)/gi },
        { key: "Ürün Kodu", pattern: /Ürün Kodu([A-Za-z0-9ğüşıöçĞÜŞİÖÇ\s\-\_]+?)(?=Barkod|Desi|Varyant|$|\n)/gi },
        { key: "Barkod", pattern: /Barkod(\d+)/gi },
        { key: "Desi", pattern: /Desi(\d+)/gi }
    ]

    techKeys.forEach(({ key, pattern }) => {
        formatted = formatted.replace(pattern, `\n- **${key}:** $1`)
    })

    // 5. Split mashed sentences
    formatted = formatted.replace(/([a-zA-ZğüşıöçĞÜŞİÖÇ0-9])\.([A-ZİÜÖÇŞĞ])/g, '$1.\n\n$2')
    formatted = formatted.replace(/([a-zA-ZğüşıöçĞÜŞİÖÇ0-9])\.\s+([A-ZİÜÖÇŞĞ])/g, '$1.\n\n$2')

    // 6. Handle checkmarks
    formatted = formatted.replace(/([^\n\s])([✔✓])/g, '$1\n$2')
    formatted = formatted.replace(/^[✔✓]\s*/gm, '- ✔ ')
    formatted = formatted.replace(/\n[✔✓]\s*/g, '\n- ✔ ')

    // 7. Handle Variant blocks
    formatted = formatted.replace(/Varyant\s*\[/gi, '\n\n**Varyant Seçenekleri:**\n- ')
    formatted = formatted.replace(/\[Renk:\s*/gi, '\n- Renk: ')
    formatted = formatted.replace(/\(Stok:\s*(\d+)\s*\)/gi, ' (Stok: $1)')
    formatted = formatted.replace(/\]/g, '')

    // 8. Handle bullets
    formatted = formatted.replace(/^\s*[•·]\s+/gm, '- ')
    formatted = formatted.replace(/^\s*•\s*/gm, '- ')

    // 9. Clean up "İthalatçı"
    formatted = formatted.replace(/\.?\s*İthalatçı\s*/gi, '.\n\n')

    // 10. Remove "Ürün Açıklaması" from start
    formatted = formatted.replace(/^(\s*##\s*)?Ürün Açıklaması\s*\n*/i, '')

    // 11. Final Cleanup
    formatted = formatted.replace(/^\s*[-*]\s*$/gm, '')
    formatted = formatted.replace(/\*\*\s*\*\*/g, '')
    formatted = formatted.replace(/\.{2,}/g, '.')
    formatted = formatted.replace(/##\s*##/g, '##')
    formatted = formatted.replace(/\n{3,}/g, '\n\n')

    return formatted.trim()
}

export default function DescriptionRenderer({ text }: { text: string }) {
    const [processed, setProcessed] = useState<string>("")
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
        // Run heavy processing only on client side after mount
        // Use a slight timeout to unblock the main thread immediately after hydration
        setTimeout(() => {
            setProcessed(preprocessDescription(text))
        }, 0)
    }, [text])

    // Server-side / Initial render: Show raw text or loading state to prevent mismatch
    // But showing raw text might layout shift. Showing valid parts is better.
    // For now, simple fallback.
    if (!isClient) {
        return (
            <div className="text-slate-500 animate-pulse">
                Yükleniyor...
            </div>
        )
    }

    return (
        <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
            <MarkdownRenderer content={processed} />
        </div>
    )
}
