import { useReveal } from '../../../hooks/useReveal'
import { AppLink } from '../../atoms/AppLink'

export function CtaBand() {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} className="section--tight reveal">
      <div className="page">
        <div className="cta-band">
          <h2 className="section-title">Fix the text. Keep the design.</h2>
          <p className="lead">Open the editor and try it on your own image. No account needed.</p>
          <AppLink href="/editor" variant="secondary" className="btn--lg">Edit an image free</AppLink>
        </div>
      </div>
    </section>
  )
}
