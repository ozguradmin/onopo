'use client'

import * as React from 'react'
import { PLACEHOLDER_IMAGE } from '@/lib/images'

export interface FallbackImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
    src: string
    /** Tried ONCE when `src` fails — e.g. the original when `src` is a resized variant. */
    fallbackSrc?: string | null
    /** Shown ONCE when everything else failed. Default /placeholder.svg; null hides nothing (keeps the broken img). */
    placeholderSrc?: string | null
    /** Always pass width/height (or an aspect-ratio box) so the image never shifts the layout. */
    width?: number | string
    height?: number | string
}

/**
 * <img> with a one-shot fallback chain: src (+srcSet) → fallbackSrc → placeholder, then it stops.
 * No retry loops and no cache-busting query strings. Also catches images that failed before
 * hydration (complete && naturalWidth === 0), which React's onError would miss.
 */
export const FallbackImage = React.forwardRef<HTMLImageElement, FallbackImageProps>(function FallbackImage(
    { src, srcSet, sizes, fallbackSrc, placeholderSrc = PLACEHOLDER_IMAGE, onError, alt = '', decoding = 'async', ...rest },
    forwardedRef,
) {
    const [stage, setStage] = React.useState(0)
    const [prevSrc, setPrevSrc] = React.useState(src)
    if (prevSrc !== src) {
        setPrevSrc(src)
        setStage(0)
    }

    const chain = React.useMemo(() => {
        const list: { src: string; srcSet?: string; sizes?: string }[] = [{ src, srcSet, sizes }]
        if (fallbackSrc && fallbackSrc !== src) list.push({ src: fallbackSrc })
        if (placeholderSrc && placeholderSrc !== src && placeholderSrc !== fallbackSrc) list.push({ src: placeholderSrc })
        return list
    }, [src, srcSet, sizes, fallbackSrc, placeholderSrc])

    const current = chain[Math.min(stage, chain.length - 1)]

    const advance = React.useCallback(() => {
        setStage(s => (s < chain.length - 1 ? s + 1 : s))
    }, [chain.length])

    const localRef = React.useRef<HTMLImageElement | null>(null)
    const setRefs = React.useCallback(
        (node: HTMLImageElement | null) => {
            localRef.current = node
            if (typeof forwardedRef === 'function') forwardedRef(node)
            else if (forwardedRef) forwardedRef.current = node
        },
        [forwardedRef],
    )

    React.useEffect(() => {
        const img = localRef.current
        if (img && stage === 0 && img.complete && img.naturalWidth === 0 && !/\.svg(\?|$)/i.test(img.currentSrc || img.src)) {
            advance()
        }
        // only on mount / when the source changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src])

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            ref={setRefs}
            src={current.src}
            srcSet={current.srcSet}
            sizes={current.srcSet ? current.sizes : undefined}
            alt={alt}
            decoding={decoding}
            onError={e => {
                advance()
                onError?.(e)
            }}
            {...rest}
        />
    )
})

export default FallbackImage
