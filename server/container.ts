import { createApi, type ApiHandler } from './api.ts'
import { loadConfig, type Config } from './config.ts'
import { connectDatabase } from './db.ts'
import { logger } from './lib/logger.ts'

interface Container {
  config: Config
  api: Promise<ApiHandler>
}

// Kept on globalThis so `next dev` hot reloads reuse one MongoDB connection instead of opening a new one each time.
const holder = globalThis as typeof globalThis & { __imageEditor?: Container }

async function boot(config: Config): Promise<ApiHandler> {
  const db = await connectDatabase(config.MONGODB_URI, config.MONGODB_DB)
  if (!config.cashfree) logger.warn('payments_disabled', { reason: 'CASHFREE_APP_ID / CASHFREE_SECRET_KEY not set' })
  else logger.info('payments_enabled', { provider: 'cashfree', mode: config.cashfree.mode })
  return createApi({ config, db })
}

function container(): Container {
  if (!holder.__imageEditor) {
    const config = loadConfig()
    const api = boot(config)
    // A failed connection must not be cached forever; the next request tries again.
    api.catch((err: unknown) => {
      logger.error('server_failed_to_start', { error: err instanceof Error ? err.message : String(err) })
      holder.__imageEditor = undefined
    })
    holder.__imageEditor = { config, api }
  }
  return holder.__imageEditor
}

/** Settings checked once at startup; a missing or malformed value stops the server with a clear message. */
export const getConfig = (): Config => container().config

/** The API handler, connected to MongoDB on first use. */
export const getApi = (): Promise<ApiHandler> => container().api
