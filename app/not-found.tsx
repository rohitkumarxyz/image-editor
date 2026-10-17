import type { Metadata } from 'next'
import { NotFoundPage } from '../src/views/NotFoundPage'

export const metadata: Metadata = { title: 'Page not found · Image Text Editor' }

export default function NotFound() {
  return <NotFoundPage />
}
