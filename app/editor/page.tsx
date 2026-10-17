import type { Metadata } from 'next'
import { EditorScreen } from './EditorScreen'

export const metadata: Metadata = { title: 'Editor · Image Text Editor' }

export default function Page() {
  return <EditorScreen />
}
