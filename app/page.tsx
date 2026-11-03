import { headers } from 'next/headers'
import { Heading, Text, Badge, Accordion, DashLogo, CopyButton } from 'dash-ui-kit/react'
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

const FEATURE_CARDS = [
  {
    badge: 'Layer 1',
    title: 'Dash Core',
    items: [
      'Send DASH with fee preview and coin control',
      'InstantSend and ChainLock status on every transaction',
      'Full history with incoming and outgoing detection',
      'Receive with QR code, label any address',
      'Contacts for the people you pay often',
    ],
  },
  {
    badge: 'Layer 2',
    title: 'Dash Platform',
    items: [
      'Register identities, funded from L1 or Platform addresses',
      'Top up, transfer and withdraw credits back to L1',
      'DPNS usernames like alice.dash resolved automatically',
      'Platform addresses for direct credit transfers',
    ],
  },
  {
    badge: 'Privacy',
    title: 'Shielded Transactions',
    items: [
      'Shield credits into the Orchard pool',
      'Send privately between shielded addresses',
      'Unshield or withdraw back out when you need to',
    ],
  },
  {
    badge: 'Network',
    title: 'Connect Your Way',
    items: [
      'Mainnet and testnet',
      'Dashscan mode: instant start, no sync',
      'P2P mode: SPV sync with BIP157/158 compact filters',
      'Manage peers, DNS seeds and fee multipliers',
    ],
  },
]

const SECURITY_CARDS = [
  {
    title: 'Non-custodial',
    body: 'Keys are derived on your machine. Nobody else can move your funds.',
  },
  {
    title: 'Encrypted at rest',
    body: 'Your recovery phrase is encrypted with AES-256-GCM using a key derived from your password with PBKDF2-SHA-512.',
  },
  {
    title: 'No tracking',
    body: 'No accounts, analytics, ads or crash reporting.',
  },
  {
    title: 'Verified sync',
    body: 'In P2P mode, headers are checked against difficulty rules and blocks against their merkle roots before anything is trusted.',
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
      'Yes. Your keys are derived and stored on your device. No third party — including the developers — can access or recover your funds. Keep your recovery phrase safe.',
  },
]

const TEAM_MEMBERS = [
  { name: 'Mikhail Pshenichnikov', role: 'Team Lead' },
  { name: 'Roman 1337', role: 'Frontend Developer' },
  { name: 'Alexey Yakushin', role: 'Fullstack Developer' },
  { name: '', role: '' },
  { name: '', role: '' },
]

const PLATFORM_NOTES: Record<Platform, string> = {
  mac: 'Universal build for Apple silicon and Intel. Signed and notarized.',
  windows: '64-bit installer for Windows 10 and 11.',
  linux: 'AppImage, .deb and Snap for x64 and arm64.',
}

function AssetList({ platform, downloads }: { platform: Platform; downloads: Download[] }) {
  const items = downloads.filter((d) => d.platform === platform)

  return (
    <div className="flex flex-col gap-2 mt-5">
      {items.length === 0 ? (
        <a href={LATEST_URL} className="download-asset">
          <span className="text-[15px]">Download</span>
        </a>
      ) : (
        items.map((d) => (
          <a key={d.name} href={d.url} className="download-asset" target="_blank" rel="noopener">
            <span className="text-[15px]">{d.label}</span>
            <span className="text-[13px] text-[color:var(--color-muted)]">
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
      {/* Header */}
      <header className="nav">
        <div className="max-w-[1344px] mx-auto px-12 flex items-center justify-between h-[72px]">
          <a href="#top" className="flex items-center gap-3 text-[color:var(--color-text)] font-semibold no-underline">
            <DashLogo width={32} height={32} />
            <span className="text-lg whitespace-nowrap">
              Desktop<br />Wallet
            </span>
          </a>
          <nav className="flex gap-7 text-[15px] nav-links">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="pt-[120px] pb-24 text-center" style={{
          background: 'radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--color-brand) 10%, transparent), transparent 70%)',
        }}>
          <div className="max-w-[1344px] mx-auto px-12">
            <Badge color="blue" className="mb-6">
              Your Dash. Your Desktop Wallet.
            </Badge>
            <Heading as="h1" size="3xl" className="text-[56px] font-extrabold tracking-[-0.03em]">
              Dash Desktop Wallet
            </Heading>
            <Text size="lg" className="max-w-[620px] mx-auto mt-6 text-[color:var(--color-muted)]">
              Core payments, Platform identities and shielded transactions in a single desktop app, built on one recovery phrase. Your keys never leave your computer.
            </Text>

            <div className="flex flex-wrap justify-center gap-3 mt-10">
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
                  ? `${release.tag} · macOS · Windows · Linux · Free and open source (MIT)`
                  : 'macOS · Windows · Linux · Free and open source (MIT)'}
            </Text>

            {/* Hero image */}
            <div className="mt-16 relative mx-auto max-w-[985px]">
              <img
                src="/icon.png"
                alt="Dash Desktop Wallet"
                className="w-[112px] h-[112px] mx-auto rounded-[24px] shadow-lg"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-[88px]">
          <div className="max-w-[1344px] mx-auto px-12">
            <div className="mb-12">
              <Heading as="h2" size="2xl" className="text-[40px] font-semibold tracking-[-0.03em]">
                Two Layers. One Dash Desktop
              </Heading>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {FEATURE_CARDS.map((card) => (
                <div key={card.title} className="feature-card p-8 flex flex-col">
                  <Badge color="blue" className="w-fit mb-4">
                    {card.badge}
                  </Badge>
                  <Heading as="h3" size="xl" className="text-2xl font-bold mb-4">
                    {card.title}
                  </Heading>
                  <ul className="list-disc pl-5 space-y-2 text-[color:var(--color-muted)] text-[15px]">
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="py-[88px]" style={{ background: 'var(--color-bg-alt)' }}>
          <div className="max-w-[1344px] mx-auto px-12">
            <Heading as="h2" size="2xl" className="text-[40px] font-semibold tracking-[-0.03em] mb-12">
              We Believe in Security and Privacy
            </Heading>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {SECURITY_CARDS.map((card) => (
                <div key={card.title} className="security-card">
                  <Heading as="h4" size="lg" className="text-lg font-semibold mb-3">
                    {card.title}
                  </Heading>
                  <Text className="text-[color:var(--color-muted)] text-[15px]">{card.body}</Text>
                </div>
              ))}
            </div>

            <div className="mt-10 p-6 border-l-[3px] border-[color:var(--color-brand)] rounded-[0_24px_24px_0] bg-white text-[color:var(--color-muted)] text-[15px]">
              <strong className="text-[color:var(--color-text)]">Write down your recovery phrase and keep it offline.</strong>{' '}
              It is the only way to restore your wallet. Nobody, including the developers, can recover it for you.
            </div>
          </div>
        </section>

        {/* Download */}
        <section id="download" className="py-[88px]">
          <div className="max-w-[1344px] mx-auto px-12">
            <Heading as="h2" size="2xl" className="text-[40px] font-semibold tracking-[-0.03em] mb-4">
              Download
            </Heading>

            <div className="flex items-center gap-3 mb-10 text-[color:var(--color-muted)] text-[15px]">
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
                  <Heading as="h3" size="xl" className="text-2xl font-bold mb-2">
                    {PLATFORM_NAMES[p]}
                  </Heading>
                  <Text className="text-[color:var(--color-muted)] text-[15px]">{PLATFORM_NOTES[p]}</Text>
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

            {/* Linux install */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mt-4">
              <div className="min-w-0 p-8 rounded-[var(--radius-card)] border border-[color:var(--color-border)]" style={{ background: 'var(--color-bg-alt)' }}>
                <Heading as="h4" size="lg" className="text-lg font-semibold mb-2">
                  Debian / Ubuntu: APT repository{' '}
                  <Badge color="blue" className="text-xs align-middle">
                    Recommended
                  </Badge>
                </Heading>
                <Text className="text-[color:var(--color-muted)] text-[15px] mb-4">
                  Signed, and updates with the rest of your system.
                </Text>
                <div className="code-block">
                  <CopyButton text={APT_COMMANDS} />
                  <pre>
                    <code>{APT_COMMANDS}</code>
                  </pre>
                </div>
              </div>

              <div className="min-w-0 p-8 rounded-[var(--radius-card)] border border-[color:var(--color-border)]" style={{ background: 'var(--color-bg-alt)' }}>
                <Heading as="h4" size="lg" className="text-lg font-semibold mb-2">
                  Snap
                </Heading>
                <Text className="text-[color:var(--color-muted)] text-[15px] mb-4">
                  Available on the <a href="https://snapcraft.io/dash-desktop-wallet" className="text-[color:var(--color-brand)]">Snap Store</a>.
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
              Looking for an older version or a pre-release? See <a href={RELEASES_URL} className="text-[color:var(--color-brand)]">all releases</a>. Prefer to build it yourself? Follow the{' '}
              <a href={`${REPO_URL}#build-from-source`} className="text-[color:var(--color-brand)]">build instructions</a>.
            </Text>
          </div>
        </section>

        {/* Team */}
        <section className="py-[88px]" style={{ background: 'var(--color-bg-alt)' }}>
          <div className="max-w-[1344px] mx-auto px-12">
            <Heading as="h2" size="2xl" className="text-[40px] font-semibold tracking-[-0.03em] mb-12 text-center">
              Team
            </Heading>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEAM_MEMBERS.filter((m) => m.name).map((member) => (
                <div key={member.name} className="security-card text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[color:color-mix(in_srgb,var(--color-brand)_12%,transparent)] flex items-center justify-center">
                    <span className="text-2xl font-bold text-[color:var(--color-brand)]">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <Heading as="h5" size="md" className="text-base font-semibold">
                    {member.name}
                  </Heading>
                  <Text size="sm" className="text-[color:var(--color-muted)]">
                    {member.role}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-[88px]">
          <div className="max-w-[1344px] mx-auto px-12">
            <Heading as="h2" size="2xl" className="text-[40px] font-semibold tracking-[-0.03em] mb-12">
              Help & FAQ
            </Heading>

            <div className="flex flex-col gap-4">
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
      <footer className="py-8">
        <div className="max-w-[1344px] mx-auto px-12">
          <div className="footer-card flex flex-wrap items-center justify-between gap-4 px-8 py-6">
            <div className="flex items-center gap-3">
              <DashLogo width={24} height={24} />
              <Text size="sm" className="text-[color:var(--color-muted)]">
                @2026 Dash Desktop Wallet
              </Text>
            </div>
            <nav className="flex gap-6 text-[14px]">
              <a href={`${REPO_URL}`} className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
                Source
              </a>
              <a href="#" className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
                Terms
              </a>
              <a href={`${REPO_URL}/blob/master/PRIVACY.md`} className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
                Privacy
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </>
  )
}