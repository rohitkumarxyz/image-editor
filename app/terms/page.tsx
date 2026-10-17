import type { Metadata } from 'next'
import { publicPacks } from '../../server/config.ts'
import { getConfig } from '../../server/container.ts'
import { LegalPage } from '../../src/views/LegalPage'

export const metadata: Metadata = { title: 'Terms & Conditions · Image Text Editor' }

export default function Page() {
  return <LegalPage kind="terms" packs={publicPacks(getConfig())} />
}
