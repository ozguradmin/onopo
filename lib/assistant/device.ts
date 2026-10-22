/**
 * Onopo Asistan: phone model detection in a customer message (pure, isomorphic).
 *
 * Why: screen protectors and cables depend on the exact model, and customers name it once ("iphone 15
 * pro max için cam var mı"). The server turns that into a normalised string for the turn context, the
 * search query and the UI's device pill. A brand word is required (a bare "a54" could be anything),
 * except for iPhone and iPad, whose names are the brand.
 */
import { foldTr } from '../search'

const BRANDS: Record<string, string> = {
    iphone: 'iPhone',
    ipad: 'iPad',
    samsung: 'Samsung',
    galaxy: 'Samsung',
    redmi: 'Redmi',
    xiaomi: 'Xiaomi',
    poco: 'Poco',
    huawei: 'Huawei',
    honor: 'Honor',
    oppo: 'Oppo',
    realme: 'Realme',
    infinix: 'Infinix',
    tecno: 'Tecno',
}

/** Words that can follow a model number ("Pro Max", "Note 13", "FE", "5G"). */
const MODIFIERS: Record<string, string> = {
    pro: 'Pro', max: 'Max', plus: 'Plus', ultra: 'Ultra', lite: 'Lite', mini: 'Mini', note: 'Note', fe: 'FE',
    neo: 'Neo', play: 'Play', hot: 'Hot', spark: 'Spark', camon: 'Camon', pova: 'Pova', smart: 'Smart',
    zero: 'Zero', nova: 'Nova', mate: 'Mate', fold: 'Fold', flip: 'Flip', air: 'Air', se: 'SE', '5g': '5G',
    x: 'X', xr: 'XR', xs: 'XS', z: 'Z', galaxy: 'Galaxy', redmi: 'Redmi',
}

function modelToken(t: string): string | null {
    if (MODIFIERS[t]) return MODIFIERS[t]
    // "15", "a54", "13t", "s24", "16e", "x6"
    if (/^[a-z]{0,2}\d{1,4}[a-z]{0,2}$/.test(t)) return t.toUpperCase().replace(/^(\d+)E$/, '$1e')
    return null
}

/** "iphone 15 pro max" → "iPhone 15 Pro Max"; "samsung a54" → "Samsung Galaxy A54"; "a54" → null. */
export function detectDevice(text: string): string | null {
    const words = foldTr(text).replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
    for (let i = 0; i < words.length; i++) {
        const brandKey = words[i]
        const brand = BRANDS[brandKey]
        if (!brand) continue
        const parts: string[] = []
        let j = i + 1
        // "xiaomi redmi note 12", "samsung galaxy a54": the second brand word belongs to the name
        if ((brandKey === 'samsung' && words[j] === 'galaxy') || (brandKey === 'xiaomi' && words[j] === 'redmi')) {
            parts.push(MODIFIERS[words[j]])
            j++
        }
        let hasNumber = false
        for (; j < words.length && parts.length < 5; j++) {
            const tok = modelToken(words[j])
            if (!tok) break
            if (/\d/.test(tok)) {
                if (hasNumber && /^\d+$/.test(tok) && parts.length && !/^(Note|Mate|Nova|Hot|Spark|Camon|Pova|Smart|Zero|Fold|Flip)$/.test(parts[parts.length - 1])) break
                hasNumber = true
            }
            parts.push(tok)
        }
        // "iPhone SE", "iPhone XR": a letter model without a number is still a model
        const letterModel = brand === 'iPhone' && parts.some(p => ['SE', 'X', 'XR', 'XS'].includes(p))
        if (!hasNumber && !letterModel) {
            if (brand === 'iPad') return parts.length ? `iPad ${parts.join(' ')}` : 'iPad'
            continue
        }
        const name = brand === 'Samsung' && parts[0] !== 'Galaxy' ? ['Galaxy', ...parts] : parts
        return `${brand} ${name.join(' ')}`.slice(0, 40)
    }
    return null
}
