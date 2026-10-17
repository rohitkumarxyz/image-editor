import type { Metadata } from 'next'
import { LegalPage } from '../../src/views/LegalPage'

export const metadata: Metadata = { title: 'Terms of use · Image Text Editor' }

export default function Page() {
  return <LegalPage kind="terms" />
}
