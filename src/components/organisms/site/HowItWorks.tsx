import { usePlayInView } from '../../../hooks/usePlayInView'
import { useReveal } from '../../../hooks/useReveal'
import { Icon, type IconName } from '../../atoms/Icon'
import { SectionHeading } from '../../molecules/site/SectionHeading'

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'upload', title: 'Upload your image', text: 'A poster, menu, banner, social post or product photo, from your phone or computer.' },
  { icon: 'scan', title: 'Click the text to change', text: 'Every line is found for you, even brush, script and Hindi lettering. Click one and type.' },
  { icon: 'download', title: 'Download', text: 'The new words match the original font and colour. Save as PNG or PDF.' },
]

export function HowItWorks() {
  const ref = useReveal<HTMLElement>()
  const videoRef = usePlayInView()
  return (
    <section ref={ref} className="section reveal" id="how">
      <div className="page">
        <SectionHeading center eyebrow="How it works" title="Three steps, under a minute" />
        <div className="steps-row">
          {STEPS.map((s, i) => (
            <article key={s.title} className="step-card">
              <span className="feature-card__icon"><Icon name={s.icon} /></span>
              <span className="step-card__num">Step {i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </article>
          ))}
        </div>
        <div className="video-frame">
          <video ref={videoRef} src="/media/image-text-editor_steps.mp4" poster="/media/steps-poster.jpg" muted loop playsInline preload="none" aria-label="Walkthrough of editing text in an image" />
        </div>
      </div>
    </section>
  )
}
