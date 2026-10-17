import type { Metadata } from 'next'
import { LegalPage } from '../../src/views/LegalPage'

export const metadata: Metadata = { title: 'Privacy Policy · Image Text Editor' }

export default function Page() {
  return <LegalPage kind="privacy" />
}
