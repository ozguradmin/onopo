import Link from 'next/link'

interface ImageCardSectionProps {
    title?: string
    image_url?: string
    link_url?: string
}

export function ImageCardSection({ title, image_url, link_url }: ImageCardSectionProps) {
    if (!image_url) return null

    const Content = () => (
        <div className="relative w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden group">
            <img
                src={image_url}
                alt={title || 'Image'}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {title && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center p-6 text-center">
                    <h3 className="text-3xl md:text-5xl font-bold text-white font-heading shadow-sm">{title}</h3>
                </div>
            )}
        </div>
    )

    if (link_url) {
        return (
            <section className="container mx-auto px-4 py-8">
                <Link href={link_url}>
                    <Content />
                </Link>
            </section>
        )
    }

    return (
        <section className="container mx-auto px-4 py-8">
            <Content />
        </section>
    )
}
