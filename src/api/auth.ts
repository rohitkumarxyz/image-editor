import { api } from './client'

export interface User {
  id: string
  email: string
  name: string
  phone: string | null
  credits: number
}

export const authApi = {
  me: () => api<{ user: User | null }>('/auth/me').then((r) => r.user),
  signInWithGoogle: (credential: string) => api<{ user: User; isNew: boolean }>('/auth/google', { body: { credential } }),
  signOut: () => api<void>('/auth/logout', { method: 'POST', body: {} }),
  updateProfile: (input: { name: string }) => api<{ user: User }>('/auth/profile', { body: input }).then((r) => r.user),
  signOutEverywhere: () => api<void>('/auth/logout-all', { method: 'POST', body: {} }),
  deleteAccount: () => api<void>('/auth/delete', { method: 'POST', body: {} }),
}
