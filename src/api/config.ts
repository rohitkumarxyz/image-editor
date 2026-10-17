import { api } from './client'

export interface PublicConfig {
  aiEditCost: number
  signupCredits: number
  paymentsEnabled: boolean
  businessName: string
  supportEmail: string
}

export const configApi = {
  get: () => api<PublicConfig>('/config'),
}
