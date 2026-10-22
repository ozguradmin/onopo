import { ChevronDown } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import type { ProductFaqItem } from '@/lib/product-faq'

/**
 * "Sık sorulan sorular" on the product page: the questions lib/product-faq.ts builds from real data. Server
 * component, no JavaScript: native <details>/<summary> rows, all closed. The answers are in the HTML either way
 * (crawlers read them), and the page's FAQPage JSON-LD carries exactly these items.
 */
export function ProductFaq({ items }: { items: ProductFaqItem[] }) {
    if (!items.length) return null
    return (
        <section id="sss" aria-labelledby="sss-baslik" className="scroll-mt-24 border-t border-line">
            <Container className="section-y">
                <div className="max-w-3xl">
                    <h2 id="sss-baslik" className="type-h2 text-ink">Sık sorulan sorular</h2>
                    <div className="mt-4 divide-y divide-line rounded-sheet border border-line">
                        {items.map(item => (
                            <details key={item.question} className="group/q">
                                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 lg:px-5 [&::-webkit-details-marker]:hidden">
                                    <h3 className="text-[15px] font-semibold leading-6 text-ink">{item.question}</h3>
                                    <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-200 group-open/q:rotate-180" aria-hidden="true" />
                                </summary>
                                <p className="max-w-[68ch] px-4 pb-4 text-sm leading-6 text-ink-2 lg:px-5">{item.answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </Container>
        </section>
    )
}

export default ProductFaq
