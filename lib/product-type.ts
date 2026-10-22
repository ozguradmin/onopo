/**
 * Product type of a product, from its name (pure and small: lib/google-feed.ts uses it for g:product_type and
 * g:google_product_category, lib/devices for the type groups of the device pages and its connector rules, and
 * lib/redirects.ts reaches it through lib/devices inside worker.ts, so it imports nothing heavy).
 */
import { foldTr } from './seo'

interface TypeRule {
    test: RegExp
    /** Turkish product type for g:product_type. */
    type: string
    /** Google product taxonomy id, or null when no category fits for sure. */
    google: number | null
}

// Checked in order on the Turkish-folded name; the first match wins. Google ids (taxonomy 2021-09-21):
//   5468   Electronics > Electronics Accessories > Electronics Films & Shields > Screen Protectors
//   505295 Electronics > Electronics Accessories > Power > Power Adapters & Chargers
//   543626 Electronics > Audio > Audio Components > Headphones & Headsets > Headphones
//   1867   Electronics > Electronics Accessories > Cables > Audio & Video Cables
//   259    Electronics > Electronics Accessories > Cables
//   618    Home & Garden > Household Appliance Accessories > Vacuum Accessories
//   619    Home & Garden > Household Appliances > Vacuums
//   500106 Electronics > Print, Copy, Scan & Fax > Printers, Copiers & Fax Machines
//   8008   Electronics > Electronics Accessories > Computer Components > Input Device Accessories > Game Controller Accessories
//   301    Electronics > Electronics Accessories > Computer Components > Input Devices > Game Controllers
const TYPE_RULES: TypeRule[] = [
    { test: /ekran koruyucu/, type: 'Ekran Koruyucu', google: 5468 },
    { test: /arac sarj/, type: 'Araç Şarj Cihazı', google: 505295 },
    { test: /powerbank|power bank/, type: 'Powerbank', google: 505295 },
    { test: /kulaklik/, type: 'Kulaklık', google: 543626 },
    { test: /\baux\b/, type: 'Ses Kablosu', google: 1867 },
    // Before the cable rule: "Şarj Aleti Seti Esnek Kablo", "Şarj Cihazı Adaptör + Şarj Kablosu" are chargers
    { test: /sarj (aleti|cihazi|adaptoru|basligi)/, type: 'Şarj Aleti', google: 505295 },
    { test: /\bkablo(su)?\b/, type: 'Şarj ve Data Kablosu', google: 259 },
    { test: /supurge.*(filtre|hazne|aparat)|hepa filtre|toz haznesi/, type: 'Süpürge Yedek Parçası', google: 618 },
    { test: /supurge/, type: 'El Süpürgesi', google: 619 },
    { test: /yazici/, type: 'Taşınabilir Yazıcı', google: 500106 },
    { test: /(oyun|gamepad|pubg).*(donusturucu|adaptor)|(donusturucu|adaptor).*(oyun|gamepad|pubg)/, type: 'Mobil Oyun Aksesuarı', google: 8008 },
    { test: /gamepad|oyun kumandasi|denetleyici|joystick/, type: 'Oyun Kumandası', google: 301 },
    { test: /oyun|pubg/, type: 'Mobil Oyun Aksesuarı', google: null },
]

/** Product type and Google category for a product name, or null when no rule matches. */
export function classifyProduct(name: string): { type: string; google: number | null } | null {
    const folded = foldTr(name || '').replace(/[^a-z0-9+.\s]/g, ' ').replace(/\s+/g, ' ')
    const rule = TYPE_RULES.find(r => r.test.test(folded))
    return rule ? { type: rule.type, google: rule.google } : null
}
