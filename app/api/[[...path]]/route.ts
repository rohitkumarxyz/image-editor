import { getApi } from '../../../server/container.ts'

// Every /api request goes through one handler, so the order of checks (CSRF, session, rate limits) stays in one place.
export const dynamic = 'force-dynamic'
// An AI edit can take over a minute (OpenAI timeout is 180s).
export const maxDuration = 200

async function handle(request: Request): Promise<Response> {
  return (await getApi())(request)
}

export { handle as GET, handle as HEAD, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS }
