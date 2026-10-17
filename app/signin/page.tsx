import type { Metadata } from 'next'
import { AuthPage } from '../../src/views/AuthPage'

export const metadata: Metadata = { title: 'Sign in · Image Text Editor' }

export default function Page() {
  return <AuthPage mode="signin" />
}
