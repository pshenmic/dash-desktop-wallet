import { headers } from 'next/headers'
import { Heading, Text, Badge, Accordion, DashLogo, CopyButton } from 'dash-ui-kit/react'
import { FeatureCarousel } from './FeatureCarousel'
import {
  ARCH_NAMES,
  LATEST_URL,
  PLATFORM_NAMES,
  PLATFORMS,
  RELEASES_URL,
  REPO_URL,
  detectPlatform,
  formatDate,
  formatSize,
  getLatestRelease,
  pickPrimary,
  type Download,
  type Platform,
} from '@/lib/releases'

const APT_COMMANDS = `curl -fsSL https://pshenmic.github.io/dash-desktop/key.asc \\
  | sudo gpg --dearmor -o /usr/share/keyrings/dash-desktop.gpg

echo "deb [signed-by=/usr/share/keyrings/dash-desktop.gpg] https://pshenmic.github.io/dash-desktop stable main" \\
  | sudo tee /etc/apt/sources.list.d/dash-desktop.list

sudo apt update && sudo apt install dash-desktop`

const SNAP_COMMAND = 'sudo snap install dash-desktop-wallet'

const NAV_LINKS = [
  { label: 'Home', href: '#top' },
  { label: 'Features', href: '#features' },
  { label: 'Download', href: '#download' },
  { label: 'Support', href: '#faq' },
  { label: 'Developers', href: REPO_URL },
]

const INTRO_CARDS = [
  {
    icon: '/figma/introlayers.svg',
    title: 'Both layers, one seed',
    body: 'Send DASH, register an identity, top it up and withdraw back to L1 without switching apps.',
  },
  {
    icon: '/figma/intro-shield.svg',
    title: 'Private by choice',
    body: 'Move credits into the shielded pool and transact between shielded addresses.',
  },
  {
    icon: '/figma/intro-node.svg',
    title: 'Your node, if you want it',
    body: 'Start instantly through Dashscan, or switch to a built-in SPV client that syncs from the Dash P2P network.',
  },
]

const SECURITY_LEFT = [
  {
    title: 'Non-custodial',
    body: 'Keys are derived on your machine. Nobody else can move your funds.',
  },
  {
    title: 'Verified sync',
    body: 'In P2P mode, headers are checked against difficulty rules and blocks against their merkle roots before anything is trusted.',
  },
]

const SECURITY_RIGHT = [
  {
    title: 'Encrypted at rest',
    body: 'Your recovery phrase is encrypted with AES-256-GCM using a key derived from your password with PBKDF2-SHA-512.',
  },
  {
    title: 'No tracking',
    body: 'No accounts, analytics, ads or crash reporting.',
  },
]

const FAQ_ITEMS = [
  {
    question: 'What Is Dash Desktop Wallet?',
    answer:
      'Dash Desktop Wallet is a non-custodial desktop application for the Dash network. It supports both Layer 1 (core payments) and Layer 2 (Dash Platform identities, DPNS, and credits), plus shielded Orchard transactions — all from a single recovery phrase.',
  },
  {
    question: 'Is Dash Desktop free to use?',
    answer:
      'Yes, Dash Desktop Wallet is free and open source (MIT license). There are no fees for the wallet itself — only standard Dash network transaction fees apply.',
  },
  {
    question: 'Can I use Dash Platform with Dash Desktop?',
    answer:
      'Yes. You can register identities, top up and transfer Platform credits, resolve DPNS names, and withdraw credits back to L1 — all from within the wallet.',
  },
  {
    question: 'Does it support shielded transactions?',
    answer:
      'Yes. Dash Desktop supports the Orchard shielded pool. You can shield funds, send privately between shielded addresses, and unshield back to transparent addresses.',
  },
  {
    question: 'Where can I get help or report a bug?',
    answer: 'Visit the GitHub issues page or the Dash community forums. Links are available in the footer.',
  },
  {
    question: 'Is Dash Desktop a non-custodial wallet?',
    answer:
      'Yes. Dash Desktop is designed to give you control over your wallet keys. Keep your recovery phrase secure and offline, as losing access to it may mean losing access to your funds.',
  },
]

const PLATFORM_NOTES: Record<Platform, string> = {
  mac: 'Universal build for Apple silicon and Intel. Signed and notarized.',
  windows: '64-bit installer for Windows 10 and 11.',
  linux: 'AppImage, .deb and Snap for x64 and arm64.',
}

const PLATFORM_ICONS: Record<Platform, string> = {
  mac: '/figma/icon-apple.svg',
  windows: '/figma/icon-windows.svg',
  linux: '/figma/icon-linux.svg',
}

function AssetList({ platform, downloads }: { platform: Platform; downloads: Download[] }) {
  const items = downloads.filter((d) => d.platform === platform)

  return (
    <div className={platform === 'linux' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
      {items.length === 0 ? (
        <a href={LATEST_URL} className="download-asset">
          <span className="text-[15px]">Download</span>
        </a>
      ) : (
        items.map((d) => (
          <a key={d.name} href={d.url} className="download-asset" target="_blank" rel="noopener">
            <span className="text-[15px]">{d.label}</span>
            <span className="text-[13px] font-normal text-[color:var(--color-muted)]">
              {ARCH_NAMES[d.arch]} · {formatSize(d.size)}
            </span>
          </a>
        ))
      )}
    </div>
  )
}

export default async function Home() {
  const requestHeaders = await headers()
  const { platform, arch } = detectPlatform(
    requestHeaders.get('user-agent') ?? '',
    requestHeaders.get('sec-ch-ua-platform') ?? '',
  )

  const release = await getLatestRelease()
  const downloads = release?.downloads ?? []
  const primary = platform ? pickPrimary(downloads, platform, arch) : null

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <div className="flex items-center gap-8">
            <a href="#top" className="flex items-center gap-2.5 text-[color:var(--color-text)]">
              <DashLogo width={28} height={28} />
              <span className="text-[13px] font-semibold leading-tight">
                Desktop
                <br />
                Wallet
              </span>
            </a>
            <nav className="nav-links">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <a className="btn-brand btn-sm" href={primary?.url ?? '#download'}>
            Download
          </a>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="pt-16 pb-16 lg:pt-24 lg:pb-20">
          <div className="max-w-[1344px] mx-auto px-12 grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-sm font-medium text-[color:var(--color-muted)] mb-3">
                Your Dash. Your Wallet
              </div>
              <Heading as="h1" size="3xl" className="text-[52px] leading-[1.03] font-extrabold tracking-[-0.03em]">
                Dash Desktop Wallet
              </Heading>
              <Text size="lg" className="mt-5 max-w-[520px] text-[color:var(--color-muted)]">
                Core payments, Platform identities and shielded transactions in a single desktop app,
                built on one recovery phrase. Your keys never leave your computer.
              </Text>

              <div className="flex flex-wrap gap-3 mt-8">
                <a className="btn-brand" href={primary?.url ?? LATEST_URL}>
                  {primary && platform ? `Download for ${PLATFORM_NAMES[platform]}` : 'Download'}
                </a>
                <a className="btn-ghost" href="#download">
                  All Platforms
                </a>
              </div>

              <Text size="sm" className="mt-5 text-[color:var(--color-muted)]">
                {primary && release
                  ? `${release.tag}${release.prerelease ? ' (pre-release)' : ''} · ${primary.label} · ${formatSize(primary.size)}`
                  : release
                    ? `${release.tag}${release.prerelease ? ' (pre-release)' : ''} · macOS · Windows · Linux`
                    : 'macOS · Windows · Linux · Free and open source (MIT)'}
              </Text>
            </div>

            <div className="relative">
              <img
                src="/figma/hero-art.png"
                alt="Dash Desktop Wallet dashboard"
                className="w-full max-w-[620px] mx-auto lg:ml-auto"
              />
            </div>
          </div>
        </section>

        {/* Intro cards */}
        <section className="pb-16">
          <div className="max-w-[1344px] mx-auto px-12 grid md:grid-cols-3 gap-4">
            {INTRO_CARDS.map((card) => (
              <div key={card.title} className="intro-card">
                <span className="icon-square mb-6">
                  <img src={card.icon} alt="" aria-hidden />
                </span>
                <Heading as="h3" size="lg" className="text-xl font-semibold mb-2">
                  {card.title}
                </Heading>
                <Text className="text-[15px] leading-relaxed text-[color:var(--color-muted)]">
                  {card.body}
                </Text>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16">
          <div className="max-w-[1344px] mx-auto px-12">
            <FeatureCarousel />
          </div>
        </section>

        {/* Security */}
        <section className="py-16">
          <div className="max-w-[1344px] mx-auto px-12 grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="eyebrow">Most Important</div>
              <Heading as="h2" size="2xl" className="text-[32px] font-semibold tracking-[-0.02em] mb-8">
                Security &amp; Privacy
              </Heading>

              <div className="security-cols">
                <div className="flex flex-col gap-4">
                  {SECURITY_LEFT.map((card) => (
                    <div key={card.title} className="security-card">
                      <Heading as="h4" size="lg" className="text-lg font-semibold mb-3">
                        {card.title}
                      </Heading>
                      <Text className="text-[15px] leading-relaxed text-[color:var(--color-muted)]">
                        {card.body}
                      </Text>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-4">
                  {SECURITY_RIGHT.map((card) => (
                    <div key={card.title} className="security-card">
                      <Heading as="h4" size="lg" className="text-lg font-semibold mb-3">
                        {card.title}
                      </Heading>
                      <Text className="text-[15px] leading-relaxed text-[color:var(--color-muted)]">
                        {card.body}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="security-shot">
              <img src="/figma/security-wallet.png" alt="Dash Desktop Wallet transactions screen" />
            </div>
          </div>
        </section>

        {/* Download */}
        <section id="download" className="py-16">
          <div className="max-w-[1344px] mx-auto px-12">
            <Heading as="h2" size="2xl" className="text-[32px] font-semibold tracking-[-0.02em] mb-3">
              Download
            </Heading>

            <div className="flex flex-wrap items-center gap-3 mb-8 text-[14px] text-[color:var(--color-muted)]">
              {release ? (
                <>
                  <span className="text-[color:var(--color-text)] font-semibold">{release.tag}</span>
                  {release.prerelease && (
                    <Badge color="orange" className="text-xs">
                      Pre-release
                    </Badge>
                  )}
                  <span>released {formatDate(release.publishedAt)}</span>
                  <span>·</span>
                  <a href={release.url} className="text-[color:var(--color-brand)]">
                    Release notes
                  </a>
                </>
              ) : (
                <>
                  Get the latest version from{' '}
                  <a href={LATEST_URL} className="text-[color:var(--color-brand)]">
                    GitHub Releases
                  </a>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {PLATFORMS.map((p) => (
                <div key={p} className={`download-card${p === platform ? ' is-current' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="icon-square">
                      <img src={PLATFORM_ICONS[p]} alt="" aria-hidden />
                    </span>
                    <Heading as="h3" size="xl" className="text-2xl font-semibold">
                      {PLATFORM_NAMES[p]}
                    </Heading>
                    {p === platform && (
                      <Badge color="blue" className="text-xs">
                        Your Platform
                      </Badge>
                    )}
                  </div>
                  <Text className="text-[15px] text-[color:var(--color-muted)] mb-5">
                    {PLATFORM_NOTES[p]}
                  </Text>
                  <AssetList platform={p} downloads={downloads} />
                  {p === 'windows' && (
                    <Text size="sm" className="mt-4 text-[color:var(--color-muted)]">
                      The installer is not code-signed yet. SmartScreen may warn — choose{' '}
                      <em>More info → Run anyway</em>.
                    </Text>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 mt-4">
              <div className="download-card min-w-0">
                <Heading as="h4" size="lg" className="text-xl font-semibold mb-2">
                  Debian / Ubuntu: APT repository{' '}
                  <Badge color="blue" className="text-xs align-middle">
                    Recommended
                  </Badge>
                </Heading>
                <Text className="text-[15px] text-[color:var(--color-muted)] mb-4">
                  Signed, and updates with the rest of your system.
                </Text>
                <div className="code-block">
                  <CopyButton text={APT_COMMANDS} />
                  <pre>
                    <code>{APT_COMMANDS}</code>
                  </pre>
                </div>
              </div>

              <div className="download-card min-w-0">
                <Heading as="h4" size="lg" className="text-xl font-semibold mb-2">
                  Snap
                </Heading>
                <Text className="text-[15px] text-[color:var(--color-muted)] mb-4">
                  Available on the{' '}
                  <a href="https://snapcraft.io/dash-desktop-wallet" className="text-[color:var(--color-brand)]">
                    Snap Store
                  </a>
                  .
                </Text>
                <div className="code-block">
                  <CopyButton text={SNAP_COMMAND} />
                  <pre>
                    <code>{SNAP_COMMAND}</code>
                  </pre>
                </div>
              </div>
            </div>

            <Text size="sm" className="mt-10 text-[color:var(--color-muted)] text-center">
              Looking for an older version or a pre-release? See{' '}
              <a href={RELEASES_URL} className="text-[color:var(--color-brand)]">
                all releases
              </a>
              . Prefer to build it yourself? Follow the{' '}
              <a href={`${REPO_URL}#build-from-source`} className="text-[color:var(--color-brand)]">
                build instructions
              </a>
              .
            </Text>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16">
          <div className="max-w-[1344px] mx-auto px-12">
            <div className="eyebrow">Help &amp; FAQ</div>
            <Heading as="h2" size="2xl" className="text-[32px] font-semibold tracking-[-0.02em] mb-8">
              We Believe in Security and Privacy
            </Heading>

            <div className="grid md:grid-cols-2 gap-4 items-start">
              {FAQ_ITEMS.map((item) => (
                <Accordion key={item.question} title={item.question}>
                  <Text className="text-[color:var(--color-muted)] leading-relaxed">{item.answer}</Text>
                </Accordion>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="pb-6">
        <div className="max-w-[1344px] mx-auto px-12">
          <div className="footer-pill">
            <a href="#top" className="flex items-center">
              <img src="/figma/footer-logo.svg" alt="Dash" className="h-7 w-auto" />
            </a>
            <nav className="flex flex-wrap items-center gap-7 text-sm">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-2 mt-4 text-[13px] text-[color:var(--color-muted)]">
            <span>©2026 Dash Desktop Wallet</span>
            <span className="flex items-center gap-3">
              <a href="#" className="hover:text-[color:var(--color-text)]">
                Terms
              </a>
              <span aria-hidden>•</span>
              <a href={`${REPO_URL}/blob/master/PRIVACY.md`} className="hover:text-[color:var(--color-text)]">
                Privacy
              </a>
            </span>
          </div>
        </div>
      </footer>
    </>
  )
}