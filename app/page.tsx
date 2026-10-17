import { publicPacks } from '../server/config.ts'
import { getConfig } from '../server/container.ts'
import { LandingPage } from '../src/views/LandingPage'

export default function Page() {
  return <LandingPage initialPacks={publicPacks(getConfig())} />
}
