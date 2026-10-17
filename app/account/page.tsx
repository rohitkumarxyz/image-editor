import type { Metadata } from 'next'
import { AccountPage } from '../../src/views/AccountPage'

export const metadata: Metadata = { title: 'Account · Image Text Editor' }

export default function Page() {
  return <AccountPage />
}
