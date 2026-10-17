import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { creditsApi, type CreditPack, type LedgerEntry } from '../api/credits'
import { AuthDialog, type AuthMode } from '../components/organisms/AuthDialog'
import { BuyCreditsDialog } from '../components/organisms/BuyCreditsDialog'
import { HistoryDialog } from '../components/organisms/HistoryDialog'
import { openCheckout } from '../lib/cashfree'
import { useSession } from '../state/sessionContext'
import { useToast } from '../state/toastContext'

export type AccountDialog = AuthMode | 'credits' | 'history'

interface AccountDialogsProps {
  dialog: AccountDialog | null
  freeCredits: number
  googleClientId: string
  onOpen: (dialog: AccountDialog) => void
  onClose: (reason: 'done' | 'dismissed') => void
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

const RETURN_PARAM = 'order_id'

export function AccountDialogs({ dialog, freeCredits, googleClientId, onOpen, onClose }: AccountDialogsProps) {
  const session = useSession()
  const { notify } = useToast()
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [packs, setPacks] = useState<{ packs: CreditPack[]; enabled: boolean } | null>(null)
  const [buyingPack, setBuyingPack] = useState<string | null>(null)
  const [inCheckout, setInCheckout] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [history, setHistory] = useState<LedgerEntry[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const returnChecked = useRef(false)

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get(RETURN_PARAM)
    if (!orderId || !session.user || returnChecked.current) return
    returnChecked.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete(RETURN_PARAM)
    window.history.replaceState(null, '', url)
    creditsApi
      .confirm(orderId)
      .then((credits) => {
        session.setCredits(credits)
        notify('success', `Payment received. You now have ${credits} credits.`)
      })
      .catch((err: unknown) => notify('error', errorMessage(err)))
  }, [session, notify])

  useEffect(() => {
    if (dialog === 'credits' && !packs) creditsApi.packs().then(setPacks).catch((err: unknown) => setBuyError(errorMessage(err)))
    if (dialog === 'history') creditsApi.history().then(setHistory).catch((err: unknown) => setHistoryError(errorMessage(err)))
  }, [dialog, packs])

  const close = (reason: 'done' | 'dismissed' = 'dismissed') => {
    setAuthError(null)
    setBuyError(null)
    setHistory(null)
    setHistoryError(null)
    onClose(reason)
  }

  const submitAuth = async (credential: string) => {
    setAuthBusy(true)
    setAuthError(null)
    try {
      const isNew = await session.signInWithGoogle(credential)
      notify('success', isNew ? (freeCredits > 0 ? `Welcome! You have ${freeCredits} free AI edits.` : 'Welcome!') : 'Signed in.')
      close('done')
    } catch (err) {
      setAuthError(errorMessage(err))
    } finally {
      setAuthBusy(false)
    }
  }

  const buy = async (packId: string, phone: string) => {
    if (!session.user) {
      onOpen('signin')
      return
    }
    setBuyingPack(packId)
    setBuyError(null)
    try {
      const checkout = await creditsApi.startCheckout({ packId, phone })
      setInCheckout(true)
      const result = await openCheckout(checkout).finally(() => setInCheckout(false))
      if (result.redirected) return
      const credits = await creditsApi.confirm(checkout.orderId).catch((err: unknown) => {
        if (err instanceof ApiError && err.code === 'conflict' && result.error) throw new Error(result.error)
        throw err
      })
      session.setCredits(credits)
      notify('success', `Payment received. You now have ${credits} credits.`)
      close('done')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') onOpen('signin')
      setBuyError(errorMessage(err))
    } finally {
      setBuyingPack(null)
    }
  }

  return (
    <>
      <AuthDialog
        key={dialog === 'signin' || dialog === 'signup' ? 'auth-open' : 'auth-closed'}
        open={dialog === 'signin' || dialog === 'signup'}
        mode={dialog === 'signup' ? 'signup' : 'signin'}
        freeCredits={freeCredits}
        googleClientId={googleClientId}
        busy={authBusy}
        error={authError}
        onCredential={submitAuth}
        onError={setAuthError}
        onClose={() => close()}
      />
      <BuyCreditsDialog
        key={dialog === 'credits' ? 'buy-open' : 'buy-closed'}
        open={dialog === 'credits' && !inCheckout}
        balance={session.user?.credits ?? 0}
        packs={packs?.packs ?? null}
        paymentsEnabled={packs?.enabled ?? false}
        savedPhone={session.user?.phone ?? null}
        busyPackId={buyingPack}
        error={buyError}
        onBuy={buy}
        onClose={() => {
          if (!buyingPack) close()
        }}
      />
      <HistoryDialog open={dialog === 'history'} entries={history} error={historyError} onClose={() => close()} />
    </>
  )
}
