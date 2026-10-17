'use client'

import type { ReactNode } from 'react'
import type { CreditPack } from '../api/credits'
import { BUSINESS } from '../lib/business'
import { useApp } from '../state/appContext'
import { SiteLayout } from './SiteLayout'

export type LegalKind = 'terms' | 'privacy' | 'refunds' | 'shipping' | 'contact'

const UPDATED = '18 October 2026'

const inr = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100)

function content(kind: LegalKind, business: string, email: string, packs: CreditPack[]): { title: string; body: ReactNode } {
  const mail = email ? <a href={`mailto:${email}`}>{email}</a> : 'our support email'
  const phone = <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`}>{BUSINESS.phone}</a>
  switch (kind) {
    case 'terms':
      return {
        title: 'Terms & Conditions',
        body: (
          <>
            <p>
              These terms apply to {business} (the "service"), operated by {BUSINESS.operator} (<a href={BUSINESS.website}>wehelpu.in</a>), {BUSINESS.location}. By using the service you agree to them.
            </p>
            <h2>What the service does</h2>
            <p>The service lets you replace text in images you upload. Basic features are free. AI exact-match edits use credits that you buy in advance.</p>
            <h2>Services and prices</h2>
            <p>All prices are in Indian Rupees (INR) and include applicable taxes.</p>
            <ul>
              <li>Free plan: {inr(0)}. Text detection, font-matched edits, crop and PNG/PDF download.</li>
              {packs.map((p) => (
                <li key={p.id}>
                  {p.name} pack: {inr(p.amount)} for {p.credits} AI edit credits ({inr(Math.round(p.amount / p.credits))} per edit).
                </li>
              ))}
            </ul>
            <h2>Allowed use</h2>
            <p>Only edit images you own or have the right to change. You must not use the service to:</p>
            <ul>
              <li>edit identity documents, certificates, marksheets, licences, invoices, receipts, bank statements, or any official or legal record;</li>
              <li>deceive people, commit fraud or forgery, or impersonate anyone;</li>
              <li>break copyright, trademark or other laws, or create harmful or abusive content.</li>
            </ul>
            <p>We may suspend accounts that break these rules, without refund of credits used for prohibited content.</p>
            <h2>Accounts</h2>
            <p>You sign in with your Google account; keep it secure. You are responsible for activity in your account. One person per account.</p>
            <h2>Credits and payments</h2>
            <p>Credits are sold in packs, are charged in advance through Cashfree and do not expire. One credit is used per AI edit. See the Refund & Cancellation policy for when credits and money are returned.</p>
            <h2>AI results</h2>
            <p>AI results are automatically checked but can still contain mistakes. Review every result before you use it.</p>
            <h2>Liability</h2>
            <p>The service is provided "as is". To the extent the law allows, our total liability is limited to the amount you paid us in the last three months.</p>
            <h2>Changes</h2>
            <p>We may update these terms. Continued use after an update means you accept it. Questions: {mail}.</p>
          </>
        ),
      }
    case 'privacy':
      return {
        title: 'Privacy Policy',
        body: (
          <>
            <h2>What we store</h2>
            <ul>
              <li>Account: your name, email address and Google account id, received from Google when you sign in. We never see your Google password.</li>
              <li>Credits: your balance and a history of purchases, AI edits and returned credits.</li>
              <li>Payments: your mobile number (the payment gateway requires it) and order and payment ids from Cashfree. Card and UPI details are handled by Cashfree, not by us.</li>
              <li>A session cookie that keeps you signed in. We don't use advertising or tracking cookies.</li>
            </ul>
            <h2>Your images</h2>
            <p>
              Images are edited in your browser and are not stored on our servers. When you use an AI feature, a copy is sent to our AI
              provider, OpenAI, to produce the result: the area around the text for an AI edit, or a smaller copy of the whole image for
              the AI text finder. OpenAI processes it under its API data policy.
            </p>
            <h2>Why we use your data</h2>
            <p>To run your account, process payments, prevent abuse and answer support requests. We don't sell your data.</p>
            <h2>Your choices</h2>
            <p>You can delete your account yourself in Account settings, or ask us to export your data by writing to {mail}. Payment and credit records are kept after deletion where the law requires businesses to keep financial records.</p>
          </>
        ),
      }
    case 'refunds':
      return {
        title: 'Refund & Cancellation Policy',
        body: (
          <>
            <p>{business} sells digital credits that are added to your account instantly after payment. This policy explains when you get credits or money back.</p>
            <h2>Credits returned automatically</h2>
            <p>If an AI edit fails because of a technical error, the credit is returned straight away.</p>
            <h2>Results that fail our checks</h2>
            <p>If the AI result is cut off, missing or in the wrong colour, it is not applied and the credit is returned, up to 5 times a day per account.</p>
            <h2>Money-back requests</h2>
            <p>
              If you bought a credit pack and haven't used any of its credits, write to {mail} within 7 days of the purchase for a full
              refund to your original payment method. Approved refunds are usually processed by Cashfree in 5–7 working days.
            </p>
            <p>Credits that have already been used for edits are not refundable.</p>
            <h2>Cancellation</h2>
            <p>
              Credit packs are one-time purchases, not subscriptions, so there is nothing to cancel and you are never charged again
              automatically. If a payment was taken but credits did not reach your account, write to {mail} or call {phone} with your
              order id and we will add the credits or refund the payment in full.
            </p>
            <p>You can delete your account at any time from Account settings.</p>
          </>
        ),
      }
    case 'shipping':
      return {
        title: 'Shipping & Delivery Policy',
        body: (
          <>
            <p>{business} is an online service. Nothing is shipped physically.</p>
            <h2>Delivery of credits</h2>
            <p>Credits are delivered digitally to your account within a few seconds of a successful payment, and you see the new balance on screen. If they do not appear within 30 minutes, contact us at {mail} or {phone} with your order id.</p>
            <h2>Delivery of edited images</h2>
            <p>Edited images are created in your browser and downloaded straight to your device as PNG or PDF.</p>
          </>
        ),
      }
    case 'contact':
      return {
        title: 'Contact Us',
        body: (
          <>
            <p>Questions about your account, a payment, a refund or an edit? We usually reply within one working day.</p>
            <ul>
              <li>Email: {mail}</li>
              <li>Phone / WhatsApp: {phone} (<a href={BUSINESS.whatsapp}>open WhatsApp chat</a>)</li>
              <li>Operated by: {BUSINESS.operator}, <a href={BUSINESS.website}>wehelpu.in</a></li>
              <li>Location: {BUSINESS.location}</li>
              <li>Working hours: {BUSINESS.hours}</li>
            </ul>
            <p>Please include the email address of your account and, for payments, the order id from your receipt.</p>
          </>
        ),
      }
  }
}

export function LegalPage({ kind, packs = [] }: { kind: LegalKind; packs?: CreditPack[] }) {
  const { config } = useApp()
  const { title, body } = content(kind, config.businessName, config.supportEmail, packs)
  return (
    <SiteLayout>
      <div className="page">
        <article className="legal">
          <h1>{title}</h1>
          <p className="muted small">Last updated {UPDATED}</p>
          {body}
        </article>
      </div>
    </SiteLayout>
  )
}
