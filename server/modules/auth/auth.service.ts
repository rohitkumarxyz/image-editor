import type { UserDoc } from '../../db.ts'
import { AppError } from '../../lib/errors.ts'
import { randomToken, sha256 } from '../../lib/crypto.ts'
import type { CreditsService } from '../credits/credits.service.ts'
import type { GoogleVerifier } from './google.client.ts'
import type { SessionsRepo } from './sessions.repo.ts'
import type { UsersRepo } from './users.repo.ts'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SIGNUP_BONUS_KEY = 'signup_bonus'

export interface PublicUser {
  id: string
  email: string
  name: string
  phone: string | null
  credits: number
}

export function toPublicUser(user: UserDoc): PublicUser {
  return { id: String(user._id), email: user.email, name: user.name, phone: user.phone ?? null, credits: user.credits }
}

export class AuthService {
  private readonly users: UsersRepo
  private readonly sessions: SessionsRepo
  private readonly credits: CreditsService
  private readonly google: GoogleVerifier
  private readonly signupCredits: number

  constructor(users: UsersRepo, sessions: SessionsRepo, credits: CreditsService, google: GoogleVerifier, signupCredits: number) {
    this.users = users
    this.sessions = sessions
    this.credits = credits
    this.google = google
    this.signupCredits = signupCredits
  }

  async signInWithGoogle(credential: string): Promise<{ user: PublicUser; token: string; isNew: boolean }> {
    const profile = await this.google.verify(credential)
    const existing = await this.users.findByEmail(profile.email)
    if (existing) {
      if (!existing.googleId) await this.users.setGoogleId(existing._id, profile.googleId)
      return { user: toPublicUser(existing), token: await this.startSession(existing), isNew: false }
    }

    const user = await this.users.create(profile)
    if (!user) return this.signInWithGoogle(credential)
    if (this.signupCredits > 0) {
      const balance = await this.credits.change({
        userId: user._id,
        delta: this.signupCredits,
        reason: 'signup_bonus',
        refId: null,
        onceKey: SIGNUP_BONUS_KEY,
      })
      user.credits = balance ?? user.credits
    }
    return { user: toPublicUser(user), token: await this.startSession(user), isNew: true }
  }

  async updateProfile(user: UserDoc, input: { name: string }): Promise<PublicUser> {
    const updated = await this.users.updateName(user._id, input.name)
    if (!updated) throw new AppError('not_found', 'Account not found.')
    return toPublicUser(updated)
  }

  async signOutEverywhere(user: UserDoc): Promise<void> {
    await this.sessions.deleteAllForUser(user._id)
  }

  async deleteAccount(user: UserDoc): Promise<void> {
    await this.sessions.deleteAllForUser(user._id)
    await this.users.delete(user._id)
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete(sha256(token))
  }

  async userForToken(token: string): Promise<UserDoc | null> {
    const session = await this.sessions.findValid(sha256(token))
    return session ? this.users.findById(session.userId) : null
  }

  private async startSession(user: UserDoc): Promise<string> {
    const token = randomToken()
    await this.sessions.create(user._id, sha256(token), SESSION_TTL_MS)
    return token
  }
}
