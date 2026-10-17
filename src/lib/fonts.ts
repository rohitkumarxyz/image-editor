export const DEVANAGARI_SANS = 'Noto Sans Devanagari'

type FontScript = 'latin' | 'devanagari' | 'both'

interface FontInfo {
  family: string
  label: string
  script: FontScript
  bold: boolean
  web: boolean
}

const FONTS: FontInfo[] = [
  { family: 'Arial', label: 'Arial (sans)', script: 'latin', bold: true, web: false },
  { family: 'Helvetica', label: 'Helvetica', script: 'latin', bold: true, web: false },
  { family: 'Roboto', label: 'Roboto', script: 'latin', bold: true, web: true },
  { family: 'Roboto Condensed', label: 'Roboto Condensed (narrow)', script: 'latin', bold: true, web: true },
  { family: 'Open Sans', label: 'Open Sans', script: 'latin', bold: true, web: true },
  { family: 'Lato', label: 'Lato', script: 'latin', bold: true, web: true },
  { family: 'Montserrat', label: 'Montserrat (geometric)', script: 'latin', bold: true, web: true },
  { family: 'Poppins', label: 'Poppins (geometric)', script: 'both', bold: true, web: true },
  { family: 'Oswald', label: 'Oswald (tall, narrow)', script: 'latin', bold: true, web: true },
  { family: 'Times New Roman', label: 'Times New Roman (serif)', script: 'latin', bold: true, web: false },
  { family: 'Merriweather', label: 'Merriweather (serif)', script: 'latin', bold: true, web: true },
  { family: 'Courier New', label: 'Courier New (typewriter)', script: 'latin', bold: true, web: false },
  { family: 'Roboto Mono', label: 'Roboto Mono (printer)', script: 'latin', bold: true, web: true },
  { family: 'Kaushan Script', label: 'Kaushan Script (brush)', script: 'latin', bold: false, web: true },
  { family: 'Caveat Brush', label: 'Caveat Brush (handwritten)', script: 'latin', bold: false, web: true },
  { family: 'Permanent Marker', label: 'Permanent Marker', script: 'latin', bold: false, web: true },
  { family: 'Dancing Script', label: 'Dancing Script (script)', script: 'latin', bold: true, web: true },
  { family: 'Pacifico', label: 'Pacifico (script)', script: 'latin', bold: false, web: true },
  { family: DEVANAGARI_SANS, label: 'Noto Sans Devanagari (Hindi)', script: 'devanagari', bold: true, web: true },
  { family: 'Noto Serif Devanagari', label: 'Noto Serif Devanagari (Hindi)', script: 'devanagari', bold: true, web: true },
  { family: 'Tiro Devanagari Hindi', label: 'Tiro Devanagari (Hindi print)', script: 'devanagari', bold: false, web: true },
  { family: 'Hind', label: 'Hind (Hindi)', script: 'devanagari', bold: true, web: true },
  { family: 'Mukta', label: 'Mukta (Hindi)', script: 'devanagari', bold: true, web: true },
]

export const FONT_OPTIONS = FONTS.map((f) => ({ value: f.family, label: f.label }))

export function hasDevanagari(text: string): boolean {
  return /[ऀ-ॿ]/.test(text)
}

export function defaultFontFor(text: string): string {
  return hasDevanagari(text) ? DEVANAGARI_SANS : 'Arial'
}

export function matchCandidates(text: string): { family: string; weight: 'normal' | 'bold' }[] {
  const script: FontScript = hasDevanagari(text) ? 'devanagari' : 'latin'
  return FONTS.filter((f) => f.script === script || f.script === 'both').flatMap((f) => [
    { family: f.family, weight: 'normal' as const },
    ...(f.bold ? [{ family: f.family, weight: 'bold' as const }] : []),
  ])
}

const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Serif+Devanagari:wght@400;700&family=Roboto+Mono:wght@400;700&family=Tiro+Devanagari+Hindi&family=Hind:wght@400;700&family=Mukta:wght@400;700&family=Roboto:wght@400;700&family=Roboto+Condensed:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;700&family=Oswald:wght@400;700&family=Merriweather:wght@400;700&family=Kaushan+Script&family=Caveat+Brush&family=Permanent+Marker&family=Dancing+Script:wght@400;700&family=Pacifico&display=swap'

let stylesheet: Promise<void> | null = null

function ensureFontStylesheet(): Promise<void> {
  stylesheet ??= new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_STYLESHEET
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
  return stylesheet
}

export async function loadWebFonts(): Promise<void> {
  await ensureFontStylesheet()
  await Promise.all(
    FONTS.filter((f) => f.web).flatMap((f) => [
      document.fonts.load(`normal 40px "${f.family}"`, 'अa'),
      ...(f.bold ? [document.fonts.load(`bold 40px "${f.family}"`, 'अa')] : []),
    ]),
  ).catch(() => undefined)
}
