import type { UserDoc } from '../../db.ts'
import { AppError } from '../../lib/errors.ts'
import { randomToken, sha256 } from '../../lib/crypto.ts'
import type { CreditsService } from '../credits/credits.service.ts'
import { hashPassword, verifyPassword } from './password.ts'
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
  /** Compared against when the email doesn't exist, so "unknown email" and "wrong password" take the same time. */
  private readonly dummyHash = hashPassword(randomToken())

  private readonly users: UsersRepo
  private readonly sessions: SessionsRepo
  private readonly credits: CreditsService
  private readonly signupCredits: number

  constructor(users: UsersRepo, sessions: SessionsRepo, credits: CreditsService, signupCredits: number) {
    this.users = users
    this.sessions = sessions
    this.credits = credits
    this.signupCredits = signupCredits
  }

  async signup(input: { email: string; name: string; password: string }): Promise<{ user: PublicUser; token: string }> {
    const user = await this.users.create({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) })
    if (!user) throw new AppError('conflict', 'An account with this email already exists. Sign in instead.')

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
    return { user: toPublicUser(user), token: await this.startSession(user) }
  }

  async login(input: { email: string; password: string }): Promise<{ user: PublicUser; token: string }> {
    const user = await this.users.findByEmail(input.email)
    const valid = await verifyPassword(input.password, user?.passwordHash ?? (await this.dummyHash))
    if (!user || !valid) throw new AppError('unauthorized', 'Email or password is incorrect.')
    return { user: toPublicUser(user), token: await this.startSession(user) }
  }

  async updateProfile(user: UserDoc, input: { name: string }): Promise<PublicUser> {
    const updated = await this.users.updateName(user._id, input.name)
    if (!updated) throw new AppError('not_found', 'Account not found.')
    return toPublicUser(updated)
  }

  /** Needs the current password; signs out every device and returns a fresh session for this one. */
  async changePassword(user: UserDoc, input: { currentPassword: string; newPassword: string }): Promise<string> {
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new AppError('unauthorized', 'Your current password is incorrect.')
    await this.users.updatePasswordHash(user._id, await hashPassword(input.newPassword))
    await this.sessions.deleteAllForUser(user._id)
    return this.startSession(user)
  }

  async signOutEverywhere(user: UserDoc): Promise<void> {
    await this.sessions.deleteAllForUser(user._id)
  }

  /**
   * Removes the account and its sessions. Payment orders and the credit ledger are kept, because
   * financial records must be retained; they only reference the (now deleted) account id.
   */
  async deleteAccount(user: UserDoc, password: string): Promise<void> {
    if (!(await verifyPassword(password, user.passwordHash))) throw new AppError('unauthorized', 'Your password is incorrect.')
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
