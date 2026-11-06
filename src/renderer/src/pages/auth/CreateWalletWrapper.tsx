import { Text, WalletIcon } from "@renderer/components/dash-ui-kit-extended";
import { ChevronIcon, DashLogo } from "dash-ui-kit/react";
import { authTexts } from "@renderer/constants";
import { useCreateWallet } from "@renderer/hooks/useCreateWallet";
import { ProgressStepBar } from "@renderer/components/dash-ui-kit-extended/progressStepBar";
import { useRipple } from "@renderer/hooks/useRipple";
import AuthBackground from '@renderer/components/pages/auth/AuthBackground'
import CreateWallet from "../../components/pages/auth/CreateWallet";
import SeedPhrase from "../../components/pages/auth/SeedPhrase";
import VerifySeedPhrase from "../../components/pages/auth/VerifySeedPhrase";
import Success from "../../components/pages/auth/Success";
import WelcomeDashDesktopWallet from "@renderer/components/pages/auth/WelcomeDashDesktopWallet"
import ImportSeedPhrase from "@renderer/components/pages/auth/ImportSeedPhrase";
import SeedPassphrase from '@renderer/components/pages/auth/SeedPassphrase'
import ConnectionModeStep from '@renderer/components/pages/auth/ConnectionModeStep'
import NetworkBadge from "@renderer/components/ui/NetworkBadge";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useWallets, refreshWallets } from "@renderer/hooks/useWallets";
import { CREATE_WALLET_PROGRESS, PASSPHRASE_PREVIEW, SEED_PASSPHRASE_COPY } from '@renderer/constants/auth'
import { WALLET_PASSWORD_LABEL } from '@renderer/constants/password'
import type { CreateWalletFlowProps, CreateWalletStep, WalletCreationPath } from '@renderer/types/auth'

export default function CreateWalletWrapper(): React.JSX.Element {
  const [params] = useSearchParams()
  const passphrasePreview = import.meta.env.DEV && params.get(PASSPHRASE_PREVIEW.query) === PASSPHRASE_PREVIEW.value
  return <CreateWalletFlow key={String(passphrasePreview)} passphrasePreview={passphrasePreview} />
}

function CreateWalletFlow({ passphrasePreview }: CreateWalletFlowProps): React.JSX.Element {
  const passphraseAvailable = import.meta.env.DEV
  const {
    createWallet,
    saveYourSeedPhrase,
    fillInYourSeedPhrase,
    seedPhraseWarning,
    success,
    successImport,
    welcome,
    importSeedPhrase,
    connectionMode: connectionModeTexts,
  } = authTexts

  const {
    step,
    generateSeedPhrase,
    setPassword,
    password,
    passphrase,
    setPassphrase,
    seedPhrase,
    importedSeedPhrase,
    wordCount,
    setWordCount,
    verifySeedPhrase,
    verifyPhrase,
    verifyMissingWords,
    goBack,
    network,
    setNetwork,
    goToPassword,
    goToImportSeedPhrase,
    submitImportSeedPhrase,
    continueImportedWallet,
    finishWalletCreation,
    connectionMode,
    backgroundSyncEnabled,
    setConnectionMode,
    setBackgroundSyncEnabled,
    path,
    createdWalletId,
    isPreviewFlow,
    creating
  } = useCreateWallet(passphrasePreview)
  const hoverAnimation = useRipple()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const wallets = useWallets()

  useEffect(() => {
    if (!passphrasePreview) refreshWallets()
  }, [passphrasePreview])

  const canExitWelcome = step === 'welcome' && (isAuthenticated || wallets.length > 0)
  const showBackButton = step !== 'welcome' || canExitWelcome
  const handleBack = (): void => {
    if (canExitWelcome) {
      navigate('/')
      return
    }
    goBack()
  }

  const titles: Partial<Record<CreateWalletStep, ReactNode>> = {
    password: passphraseAvailable ? SEED_PASSPHRASE_COPY.walletPasswordTitle : createWallet.title,
    'seed-phrase': saveYourSeedPhrase.title,
    verify: fillInYourSeedPhrase.title,
    welcome: (
      <span className="inline-block max-w-125 leading-[100%]">
        <span className="font-normal">{welcome.titlePrefix}</span>{' '}
        <span className="font-bold">{welcome.titleHighlight}</span>
      </span>
    ),
    'import-seed-phrase': importSeedPhrase.title,
    'password-import': passphraseAvailable ? SEED_PASSPHRASE_COPY.walletPasswordTitle : 'Create Password',
    'connection-mode': connectionModeTexts.title,
  }

  const descriptions: Partial<Record<CreateWalletStep, string>> = {
    password: passphraseAvailable ? SEED_PASSPHRASE_COPY.walletPasswordHint : createWallet.description,
    'seed-phrase': passphraseAvailable ? SEED_PASSPHRASE_COPY.backupWords : saveYourSeedPhrase.description,
    verify: fillInYourSeedPhrase.description,
    welcome: welcome.description,
    'import-seed-phrase': importSeedPhrase.description,
    'password-import': passphraseAvailable ? SEED_PASSPHRASE_COPY.walletPasswordHint : createWallet.description,
    'connection-mode': isPreviewFlow ? PASSPHRASE_PREVIEW.finishHint : connectionModeTexts.description,
  }

  const connectionModeActionLabels: Record<WalletCreationPath, string> = {
    create: connectionModeTexts.buttonCreate,
    import: connectionModeTexts.buttonImport,
  }

  const title = titles[step] ?? ''
  const description = descriptions[step] ?? ''
  const progress = path === null ? null : CREATE_WALLET_PROGRESS[path]
  const recoveryWarning = passphrase
    ? path === 'create'
      ? { title: SEED_PASSPHRASE_COPY.backupTitle, description: SEED_PASSPHRASE_COPY.createHint }
      : { ...seedPhraseWarning, description: SEED_PASSPHRASE_COPY.warning }
    : seedPhraseWarning
  const passwordData = {
    ...createWallet,
    labelPassword: passphraseAvailable ? WALLET_PASSWORD_LABEL : createWallet.labelPassword,
    labelConfirmPassword: passphraseAvailable ? SEED_PASSPHRASE_COPY.walletPasswordConfirm : createWallet.labelConfirmPassword,
  }

  if (step === 'success') {
    const data = isPreviewFlow ? PASSPHRASE_PREVIEW.success : path === 'create' ? success : successImport
    return <Success data={data} walletId={createdWalletId} />
  }

  return (
    <div className={"relative flex min-h-screen items-end"}>
      <AuthBackground variant={step === 'welcome' ? 'welcome' : 'create'} />

      {showBackButton &&
        <button
          type="button"
          aria-label="Back"
          disabled={creating}
          onMouseEnter={hoverAnimation.onMouseEnter}
          onMouseMove={hoverAnimation.onMouseMove}
          onMouseLeave={hoverAnimation.onMouseLeave}
          className={`
            z-50
            absolute
            top-12
            left-12
            overflow-hidden
            size-12
            flex
            items-center
            justify-center
            rounded-[.9375rem]
            cursor-pointer
            bg-dash-brand/80
            dark:bg-white/12
            backdrop-blur-[.5rem]
            transition-opacity
            disabled:cursor-not-allowed
            disabled:opacity-40
          `}
          onClick={handleBack}
        >
          <ChevronIcon
            size={17}
            className={`
            text-white
            rotate-90
          `}/>
        </button>
      }

      <NetworkBadge network={network} onChange={setNetwork} />

      <div className={"relative flex flex-col w-full h-full items-center justify-end p-12 pt-[max(9rem,25vh)]"}>
        <div className={"flex flex-col w-full mb-8"}>
          <div className={'flex items-center gap-3'}>
            <DashLogo containerSize={50} />
            {isPreviewFlow && (
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                {passphrasePreview ? PASSPHRASE_PREVIEW.badge : PASSPHRASE_PREVIEW.flowBadge}
              </Text>
            )}
          </div>
          <Text as={"h1"} className={"mt-6 leading-[78%] tracking-[-0.03em]"} color={"brand"} size={64} weight={"extrabold"}>{title}</Text>
          <Text as={"p"} className={"mt-6"} color={"brand"}size={18} weight={"medium"} opacity={50}>{description}</Text>
        </div>

        {step === 'welcome' &&
          <WelcomeDashDesktopWallet onCreateWallet={goToPassword} onImportSeedPhrase={goToImportSeedPhrase} data={{
            createWallet: welcome.buttonCreateWallet,
            importSeedPhrase: welcome.buttonImportSeedPhrase,
          }} />
        }

        {step === 'password' &&
          <CreateWallet
            setPassword={setPassword}
            password={password}
            generateSeedPhrase={generateSeedPhrase}
            data={passwordData}
          />
        }

        {step === 'password-import' &&
          <CreateWallet
            setPassword={setPassword}
            password={password}
            continueImportedWallet={continueImportedWallet}
            data={passwordData}
          />
        }
        {step === 'seed-phrase' &&
          <SeedPhrase
            data={{
              buttonContinue: saveYourSeedPhrase.buttonContinue,
              buttonCopy: passphraseAvailable ? SEED_PASSPHRASE_COPY.copyWords : saveYourSeedPhrase.buttonCopy,
              seedPhraseWarning: recoveryWarning
            }}
            seedPhrase={seedPhrase}
            verifySeedPhrase={verifySeedPhrase}
            wordCount={wordCount}
            setWordCount={setWordCount}
          >
            {passphraseAvailable && <SeedPassphrase path={'create'} value={passphrase} onChange={setPassphrase} />}
          </SeedPhrase>
        }
        {step === 'verify' &&
          <VerifySeedPhrase
            verifyPhrase={verifyPhrase}
            verifyMissingWords={verifyMissingWords}
            passphrase={passphrase}
            data={{
              buttonContinue: fillInYourSeedPhrase.buttonContinue,
              seedPhraseWarning: recoveryWarning
            }}
        />}

        {step === 'import-seed-phrase' &&
          <ImportSeedPhrase
            submitImportSeedPhrase={submitImportSeedPhrase}
            initialWords={passphraseAvailable ? importedSeedPhrase : undefined}
            data={{
              buttonContinue: importSeedPhrase.buttonContinue,
              seedPhraseWarning: recoveryWarning
            }}
          >
            {passphraseAvailable && <SeedPassphrase path={'import'} value={passphrase} onChange={setPassphrase} />}
          </ImportSeedPhrase>
        }

        {step === 'connection-mode' && path !== null &&
          <ConnectionModeStep
            mode={connectionMode}
            backgroundSyncEnabled={backgroundSyncEnabled}
            actionLabel={isPreviewFlow ? PASSPHRASE_PREVIEW.finish : connectionModeActionLabels[path]}
            loadingNotice={createWallet.slowCreationNotice}
            onModeChange={setConnectionMode}
            onBackgroundSyncChange={setBackgroundSyncEnabled}
            onConfirm={finishWalletCreation}
          />
        }

        {step !== 'welcome' && progress !== null &&
          <ProgressStepBar
            currentStep={progress.stepNumbers[step] ?? progress.totalSteps}
            totalSteps={progress.totalSteps}
            className={"mt-[.75rem]"}
            color={"blue-mint"}
          />
        }

        {step === 'password' &&
          <button className={"flex items-center gap-2 group cursor-pointer mt-6"} onClick={goToImportSeedPhrase}>
            <WalletIcon
              size={16}
              className={`
              dash-text-default
              opacity-35
              group-hover:opacity-100
            group-hover:text-dash-brand
            dark:group-hover:text-dash-mint
              transition-[opacity,color]
              `}
            />
            <Text
              size={16}
              color={"brand"}
              opacity={30}
              className={`
                group-hover:opacity-100
              group-hover:text-dash-brand
              dark:group-hover:text-dash-mint
                transition-[opacity,color]
              `}>
              {createWallet.importWallet}
            </Text>
          </button>
        }
      </div>
    </div>
  )
}
