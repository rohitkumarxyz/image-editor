'use client'

import dynamic from 'next/dynamic'

export const EditorScreen = dynamic(() => import('../../src/views/EditorPage').then((m) => m.EditorPage), {
  ssr: false,
  loading: () => (
    <div className="app app--empty">
      <p className="muted">Loading editor…</p>
    </div>
  ),
})
