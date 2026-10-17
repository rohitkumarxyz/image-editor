/** Real before/after results made with this app's AI exact match (see /public/examples). */
export interface Example {
  id: string
  label: string
  before: string
  after: string
  alt: string
  change: string
}

export const EXAMPLES: Example[] = [
  { id: 'poster', label: 'Poster', before: '/examples/poster-before.jpg', after: '/examples/poster-after.jpg', alt: 'Sunrise quote poster', change: '“Things” → “Days” in brush lettering, and “BIG DREAMS” → “BIG DREAMS EVERY DAY”' },
  { id: 'menu', label: 'Café menu', before: '/examples/menu-before.jpg', after: '/examples/menu-after.jpg', alt: 'Café menu card', change: '“Cold Coffee” → “Iced Latte” and ₹120 → ₹140' },
  { id: 'sale', label: 'Sale banner', before: '/examples/sale-before.jpg', after: '/examples/sale-after.jpg', alt: 'Festive sale banner', change: '30% → 50% on a gradient background' },
  { id: 'hindi', label: 'Hindi poster', before: '/examples/hindi-before.jpg', after: '/examples/hindi-after.jpg', alt: 'Hindi sweet shop poster', change: '“गरम समोसा” → “गरम कचौरी”' },
]
