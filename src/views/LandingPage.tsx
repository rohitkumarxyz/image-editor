'use client'

import { useEffect, useState } from 'react'
import { creditsApi, type CreditPack } from '../api/credits'
import { CardSection, type CardItem } from '../components/organisms/site/CardSection'
import { CtaBand } from '../components/organisms/site/CtaBand'
import { ExamplesSection } from '../components/organisms/site/ExamplesSection'
import { FaqSection } from '../components/organisms/site/FaqSection'
import { Hero } from '../components/organisms/site/Hero'
import { HowItWorks } from '../components/organisms/site/HowItWorks'
import { PricingSection } from '../components/organisms/site/PricingSection'
import { EXAMPLES, type Example } from '../lib/examples'
import { useApp } from '../state/appContext'
import { useRouter } from '../state/routerContext'
import { useSession } from '../state/sessionContext'
import { useToast } from '../state/toastContext'
import { SiteLayout } from './SiteLayout'

const FEATURED_PACK = 'pro'
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const USE_CASES: CardItem[] = [
  { icon: 'store', title: 'Shops & small businesses', text: 'Update offers, prices and phone numbers on posters and shop boards without a designer.' },
  { icon: 'utensils', title: 'Restaurants & cafés', text: 'Change dishes and prices on your menu photo in a minute.' },
  { icon: 'megaphone', title: 'Social media & creators', text: 'Reuse one design for every post: swap the date, the headline or the name.' },
  { icon: 'tag', title: 'Sales & events', text: 'Turn last season’s banner into this week’s offer: 30% becomes 50%.' },
  { icon: 'language', title: 'Hindi & English', text: 'Translate a design between Hindi and English in a matching style.' },
  { icon: 'pencil', title: 'Fix typos', text: 'Correct a spelling mistake in a finished image when the source file is lost.' },
]

const FEATURES: CardItem[] = [
  { icon: 'scan', title: 'Finds any lettering', text: 'Brush, script, tilted, spaced-out capitals, coloured text, Hindi and English.' },
  { icon: 'type', title: 'Matches the font', text: 'Font, weight, size, colour, letter spacing and slant are measured from your image.' },
  { icon: 'sparkles', title: 'AI exact match', text: 'For a pixel-perfect result, AI redraws the words in the original lettering.' },
  { icon: 'shield', title: 'Checked before it’s applied', text: 'Results that are cut off, empty or the wrong colour are rejected, and you get the credit back.' },
  { icon: 'crop', title: 'Crop any shape', text: 'Rectangle, circle, rounded, polygon or freehand, with ratios like 1:1, 4:5 and 16:9.' },
  { icon: 'lock', title: 'Private', text: 'Images are processed for your edit only and never stored on our servers.' },
]

const FAQ = [
  { question: 'Is it free?', answer: 'Yes. Detecting text, normal edits, cropping and PNG/PDF downloads are free, with no account. Only AI exact-match edits use credits.' },
  { question: 'What is a credit?', answer: 'One credit pays for one AI exact-match edit of one text box.' },
  { question: 'What if the AI result is not right?', answer: 'Each result is checked before it is used. If the text ends up outside its box, missing or in the wrong colour, it is not applied and your credit is returned (up to 5 times a day). You can then try again.' },
  { question: 'Do credits expire?', answer: 'No. Credits stay in your account until you use them.' },
  { question: 'Do you keep my images?', answer: 'No. Your image is edited in your browser. Only the AI features send a copy to our AI provider (OpenAI): the area around the text for an AI edit, or a smaller copy of the whole image for the AI text finder. Nothing is saved on our servers.' },
  { question: 'Which languages work?', answer: 'English and Hindi (Devanagari), including lines that mix both. The AI text finder also reads decorative and handwritten lettering.' },
  { question: 'Can I edit ID cards, certificates or official documents?', answer: 'No. Editing identity documents, certificates, marksheets, invoices, bank statements or any official record is not allowed and is against our terms.' },
  { question: 'How do I pay?', answer: 'Through Cashfree: UPI, debit and credit cards, net banking and wallets. Credits are added as soon as the payment is confirmed.' },
]

export function LandingPage({ initialPacks }: { initialPacks: CreditPack[] }) {
  const session = useSession()
  const { config, openAccount, setPendingFile } = useApp()
  const { navigate } = useRouter()
  const toast = useToast()
  const [packs, setPacks] = useState<CreditPack[] | null>(initialPacks)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    creditsApi
      .packs()
      .then((r) => setPacks(r.packs))
      .catch(() => setPacks([]))
  }, [])

  const openFile = (file: File) => {
    if (!file.type.startsWith('image/')) return setUploadError('Please choose an image file (PNG, JPG or WEBP).')
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError('That image is larger than 25 MB. Please use a smaller one.')
    setPendingFile(file)
    navigate('/editor')
  }

  const openExample = async (example: Example) => {
    try {
      const blob = await fetch(example.before).then((r) => r.blob())
      openFile(new File([blob], `${example.id}.jpg`, { type: blob.type || 'image/jpeg' }))
    } catch {
      setUploadError('Could not load the example. Check your connection and try again.')
    }
  }

  const buy = () => {
    if (!session.user) {
      toast.notify('info', 'Create a free account first; your free AI edits are added right away.')
      openAccount('signup', () => openAccount('credits'))
      return
    }
    openAccount('credits')
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      openFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  return (
    <SiteLayout>
      <Hero freeCredits={config.signupCredits} examples={EXAMPLES} error={uploadError} onFile={openFile} onExample={openExample} />
      <ExamplesSection examples={EXAMPLES} />
      <HowItWorks />
      <CardSection id="use-cases" eyebrow="Made for" title="Anyone with words on an image" items={USE_CASES} alt />
      <CardSection id="features" eyebrow="Features" title="Built to make edits invisible" items={FEATURES} />
      <PricingSection packs={packs} freeCredits={config.signupCredits} featuredPackId={FEATURED_PACK} onBuy={buy} />
      <FaqSection items={FAQ} />
      <CtaBand />
    </SiteLayout>
  )
}
