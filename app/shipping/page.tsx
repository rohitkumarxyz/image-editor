import type { Metadata } from 'next'
import { LegalPage } from '../../src/views/LegalPage'

export const metadata: Metadata = { title: 'Shipping & Delivery Policy · Image Text Editor' }

export default function Page() {
  return <LegalPage kind="shipping" />
}
