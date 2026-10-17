import { api } from './client'

export interface User {
  id: string
  email: string
  name: string
  /** Saved at the first purchase; the payment gateway needs it. */
  phone: string | null
  credits: number
}

export const authApi = {
  me: () => api<{ user: User | null }>('/auth/me').then((r) => r.user),
  signUp: (input: { name: string; email: string; password: string }) => api<{ user: User }>('/auth/signup', { body: input }).then((r) => r.user),
  signIn: (input: { email: string; password: string }) => api<{ user: User }>('/auth/login', { body: input }).then((r) => r.user),
  signOut: () => api<void>('/auth/logout', { method: 'POST', body: {} }),
  updateProfile: (input: { name: string }) => api<{ user: User }>('/auth/profile', { body: input }).then((r) => r.user),
  changePassword: (input: { currentPassword: string; newPassword: string }) => api<void>('/auth/password', { body: input }),
  signOutEverywhere: () => api<void>('/auth/logout-all', { method: 'POST', body: {} }),
  deleteAccount: (input: { password: string }) => api<void>('/auth/delete', { body: input }),
}
