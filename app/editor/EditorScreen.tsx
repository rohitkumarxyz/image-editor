'use client'

import dynamic from 'next/dynamic'

// The editor (OCR, fonts, canvas tools) loads only when opened, keeping the landing page light. It needs the
// browser (canvas, workers), so it never renders on the server.
export const EditorScreen = dynamic(() => import('../../src/views/EditorPage').then((m) => m.EditorPage), {
  ssr: false,
  loading: () => (
    <div className="app app--empty">
      <p className="muted">Loading editor…</p>
    </div>
  ),
})
