import { api } from './client'

export interface AiWordBox {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface AiEditResult {
  jobId: string
  /** Base64 PNG drafts. */
  images: string[]
  credits: number
}

export const aiApi = {
  edit: (input: { image: string; mask: string; size: string; oldText: string; newText: string; color?: string; fontHint?: string }) =>
    api<AiEditResult>('/ai/edit', { body: input }),
  refund: (jobId: string) => api<{ credits: number }>(`/ai/edit/${encodeURIComponent(jobId)}/refund`, { method: 'POST', body: {} }).then((r) => r.credits),
  detect: (input: { image: string; width: number; height: number }) => api<{ words: AiWordBox[] }>('/ai/detect', { body: input }).then((r) => r.words),
}
