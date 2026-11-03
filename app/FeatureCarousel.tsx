'use client'

import { useState } from 'react'

type Item = { icon: string; text: string }

type Slide = {
  label: string
  title: string
  image?: string
  items: Item[]
}

const SLIDES: Slide[] = [
  {
    label: 'Layer 1',
    title: 'Dash Core',
    image: '/figma/feature-l1.png',
    items: [
      { icon: '/figma/icon-send.svg', text: 'Send DASH with **fee preview** and **coin control**' },
      { icon: '/figma/icon-instantsend.svg', text: '**InstantSend** and **ChainLock** status on every transaction' },
      { icon: '/figma/icon-qr.svg', text: 'Receive with **QR** code & **label** any address' },
      { icon: '/figma/icon-contacts.svg', text: '**Contacts** for the people you **pay often**' },
    ],
  },
  {
    label: 'Layer 2',
    title: 'Dash Platform',
    items: [
      { icon: '/figma/icon-send.svg', text: 'Register **identities**, funded from L1 or Platform addresses' },
      { icon: '/figma/icon-qr.svg', text: 'Top up, transfer and **withdraw credits** back to L1' },
      { icon: '/figma/icon-contacts.svg', text: '**DPNS** usernames resolved automatically' },
      { icon: '/figma/icon-instantsend.svg', text: '**Platform addresses** for direct credit transfers' },
    ],
  },
  {
    label: 'Network',
    title: 'DashPay',
    items: [
      { icon: '/figma/icon-contacts.svg', text: 'Send and request payments with **usernames**' },
      { icon: '/figma/icon-send.svg', text: 'Pay **contacts** by name, not by address' },
      { icon: '/figma/icon-instantsend.svg', text: '**Instant** and final settlement' },
      { icon: '/figma/icon-qr.svg', text: 'Manage identities **on-chain**' },
    ],
  },
  {
    label: 'Privacy',
    title: 'Shielded TXs',
    items: [
      { icon: '/figma/icon-instantsend.svg', text: '**Shield** credits into the Orchard pool' },
      { icon: '/figma/icon-send.svg', text: 'Send **privately** between shielded addresses' },
      { icon: '/figma/icon-qr.svg', text: '**Unshield** or withdraw when you need to' },
      { icon: '/figma/icon-contacts.svg', text: 'Your balance, **your business**' },
    ],
  },
]

function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-bold text-[color:var(--color-text)]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function FeatureCarousel() {
  const [active, setActive] = useState(0)
  const slide = SLIDES[active]
  const strips = SLIDES.map((s, i) => ({ ...s, i })).filter((s) => s.i !== active)

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <div className="eyebrow">Features</div>
          <h2 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
            Two Layers. One Dash Desktop
          </h2>
        </div>
        <div className="dots" role="tablist" aria-label="Feature slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              className="dot"
              aria-current={i === active}
              aria-label={s.title}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>

      <div className="feature-row">
        <div className="feature-active flex-1">
          <div className={`relative z-10 p-8 ${slide.image ? 'lg:max-w-[56%]' : ''}`}>
            <span className="pill-blue inline-block rounded-full px-3 py-1 text-xs font-semibold mb-4">
              {slide.label}
            </span>
            <h3 className="text-[26px] font-bold tracking-[-0.02em] mb-7">{slide.title}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-7">
              {slide.items.map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <span className="icon-square icon-square-sm">
                    <img src={item.icon} alt="" aria-hidden />
                  </span>
                  <p className="text-[15px] leading-snug text-[color:var(--color-muted)]">
                    {bold(item.text)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {slide.image && <img className="feature-shot" src={slide.image} alt="Dash Desktop Wallet dashboard" />}
        </div>

        {strips.map((s) => (
          <button
            key={s.title}
            className="feature-strip"
            onClick={() => setActive(s.i)}
            aria-label={`Show ${s.title}`}
          >
            <span className="strip-label pill-gray">{s.label}</span>
            <span className="strip-title">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}