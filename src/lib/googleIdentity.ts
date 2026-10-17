const SCRIPT_URL = 'https://accounts.google.com/gsi/client'

interface GoogleButtonOptions {
  type: 'standard'
  theme: 'outline'
  size: 'large'
  text: 'signin_with' | 'signup_with' | 'continue_with'
  shape: 'rectangular'
  width?: number
}

interface GoogleAccountsId {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode: 'popup' }) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('Could not load Google sign-in. Check your connection and try again.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export async function renderGoogleButton(
  parent: HTMLElement,
  options: { clientId: string; text: GoogleButtonOptions['text']; width: number; onCredential: (credential: string) => void },
): Promise<void> {
  await loadScript()
  const id = window.google!.accounts.id
  id.initialize({
    client_id: options.clientId,
    ux_mode: 'popup',
    callback: (response) => {
      if (response.credential) options.onCredential(response.credential)
    },
  })
  id.renderButton(parent, { type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular', text: options.text, width: options.width })
}
