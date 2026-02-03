import Link from 'next/link'
import { getImageUrl } from "@/lib/utils"

interface ImageCardSectionProps {
    title?: string
    image_url?: string
    link_url?: string
}

export function ImageCardSection({ title, image_url, link_url }: ImageCardSectionProps) {
    const Content = () => (
        <div className="relative w-full rounded-2xl overflow-hidden group">
            <img
                src={getImageUrl(image_url)}
                alt={title || 'Image'}
                className="w-full h-auto max-h-[300px] object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Title removed as requested */}
        </div>
    )

    if (link_url) {
        return (
            <section className="container mx-auto px-4 py-8 max-w-4xl">
                <Link href={link_url}>
                    <Content />
                </Link>
            </section>
        )
    }

    return (
        <section className="container mx-auto px-4 py-8 max-w-4xl">
            <Content />
        </section>
    )
}
