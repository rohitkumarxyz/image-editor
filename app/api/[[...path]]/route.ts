import { getApi } from '../../../server/container.ts'

export const dynamic = 'force-dynamic'
export const maxDuration = 200

async function handle(request: Request): Promise<Response> {
  return (await getApi())(request)
}

export { handle as GET, handle as HEAD, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS }
