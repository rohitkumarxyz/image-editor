import type { Metadata } from 'next'
import { LegalPage } from '../../src/views/LegalPage'

export const metadata: Metadata = { title: 'Contact Us · Image Text Editor' }

export default function Page() {
  return <LegalPage kind="contact" />
}
