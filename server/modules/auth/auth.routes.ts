import { z } from 'zod'
import { parse } from '../../lib/validate.ts'
import type { SessionCookie } from '../../http/cookies.ts'
import { Reply, get, post, requireUser, type Middleware, type Route } from '../../http/router.ts'
import { toPublicUser, type AuthService } from './auth.service.ts'

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')).pipe(z.string().max(254))
const password = z.string().min(8, 'Password must be at least 8 characters.').max(128, 'Password is too long.')

const signupBody = z.object({
  email,
  password,
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Name is too long.'),
})
const loginBody = z.object({ email, password: z.string().min(1, 'Enter your password.').max(128) })
const name = z.string().trim().min(1, 'Enter your name.').max(80, 'Name is too long.')
const profileBody = z.object({ name })
const passwordBody = z.object({ currentPassword: z.string().min(1, 'Enter your current password.').max(128), newPassword: password })
const deleteBody = z.object({ password: z.string().min(1, 'Enter your password.').max(128) })

export interface AuthLimits {
  signup: Middleware
  login: Middleware
}

export function authRoutes(auth: AuthService, cookie: SessionCookie, limits: AuthLimits): Route[] {
  return [
    post('/signup', [limits.signup], async (req) => {
      const { user, token } = await auth.signup(parse(signupBody, req.body))
      return Reply.json({ user }, 201).setCookie(cookie, token)
    }),

    post('/login', [limits.login], async (req) => {
      // A new token on every sign-in, so a session id seen before login can't be reused (session fixation).
      if (req.sessionToken) await auth.logout(req.sessionToken)
      const { user, token } = await auth.login(parse(loginBody, req.body))
      return Reply.json({ user }).setCookie(cookie, token)
    }),

    post('/logout', [], async (req) => {
      if (req.sessionToken) await auth.logout(req.sessionToken)
      return Reply.empty().clearCookie(cookie)
    }),

    // Signed-out visitors get `null`, not an error: every page load asks this.
    post('/profile', [requireUser], async (req) => Reply.json({ user: await auth.updateProfile(req.user!, parse(profileBody, req.body)) })),

    post('/password', [requireUser, limits.login], async (req) => {
      const token = await auth.changePassword(req.user!, parse(passwordBody, req.body))
      return Reply.empty().setCookie(cookie, token)
    }),

    post('/logout-all', [requireUser], async (req) => {
      await auth.signOutEverywhere(req.user!)
      return Reply.empty().clearCookie(cookie)
    }),

    post('/delete', [requireUser, limits.login], async (req) => {
      await auth.deleteAccount(req.user!, parse(deleteBody, req.body).password)
      return Reply.empty().clearCookie(cookie)
    }),

    get('/me', [], (req) => Reply.json({ user: req.user ? toPublicUser(req.user) : null })),
  ]
}
