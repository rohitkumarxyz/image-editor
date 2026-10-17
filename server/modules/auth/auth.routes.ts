import { z } from 'zod'
import { parse } from '../../lib/validate.ts'
import type { SessionCookie } from '../../http/cookies.ts'
import { Reply, get, post, requireUser, type Route } from '../../http/router.ts'
import { toPublicUser, type AuthService } from './auth.service.ts'

const googleBody = z.object({ credential: z.string().min(1, 'Google sign-in failed. Please try again.').max(4096) })
const name = z.string().trim().min(1, 'Enter your name.').max(80, 'Name is too long.')
const profileBody = z.object({ name })

export function authRoutes(auth: AuthService, cookie: SessionCookie): Route[] {
  return [
    post('/google', [], async (req) => {
      if (req.sessionToken) await auth.logout(req.sessionToken)
      const { user, token, isNew } = await auth.signInWithGoogle(parse(googleBody, req.body).credential)
      return Reply.json({ user, isNew }, isNew ? 201 : 200).setCookie(cookie, token)
    }),

    post('/logout', [], async (req) => {
      if (req.sessionToken) await auth.logout(req.sessionToken)
      return Reply.empty().clearCookie(cookie)
    }),

    post('/profile', [requireUser], async (req) => Reply.json({ user: await auth.updateProfile(req.user!, parse(profileBody, req.body)) })),

    post('/logout-all', [requireUser], async (req) => {
      await auth.signOutEverywhere(req.user!)
      return Reply.empty().clearCookie(cookie)
    }),

    post('/delete', [requireUser], async (req) => {
      await auth.deleteAccount(req.user!)
      return Reply.empty().clearCookie(cookie)
    }),

    get('/me', [], (req) => Reply.json({ user: req.user ? toPublicUser(req.user) : null })),
  ]
}
