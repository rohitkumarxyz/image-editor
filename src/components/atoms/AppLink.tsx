import type { ComponentProps, MouseEvent } from 'react'
import { useRouter } from '../../state/routerContext'

type AppLinkProps = ComponentProps<'a'> & { href: string; variant?: 'primary' | 'secondary' | 'ghost' | 'plain' }

/** An <a> that navigates inside the app (real links for SEO and open-in-new-tab), optionally styled as a button. */
export function AppLink({ href, variant = 'plain', className = '', onClick, ...rest }: AppLinkProps) {
  const { navigate } = useRouter()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    const internal = href.startsWith('/') || href.startsWith('#')
    if (!internal || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(href.startsWith('#') ? `/${href}` : href)
  }
  const classes = [variant === 'plain' ? '' : `btn btn--${variant}`, className].filter(Boolean).join(' ')
  return <a href={href} className={classes || undefined} onClick={handle} {...rest} />
}
