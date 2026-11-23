import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, CheckIcon, DeleteIcon, EyeClosedIcon, EyeOpenIcon, HighlightedIdentifier, InfoCircleIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import Spinner from '@renderer/components/ui/Spinner'
import { API } from '@renderer/api'
import type { ImportedMasternodeKeyDto, MasternodeKeyRole } from '@renderer/api/types'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { FIELD_INVALID } from '@renderer/constants/addressField'
import { WIF_ROLE_OPTIONS } from '@renderer/constants/masternodeKeys'
import {
  MANAGE_KEYS_COPY,
  MASTERNODE_KEY_ROLE_LABELS,
  NODES_TAB_COPY,
  NODE_MATCHED_FORMS,
} from '@renderer/constants/masternodeNodes'
import { CHIP_ACTION, FIELD_COMPACT, SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshImportedMasternodeKeys, refreshMasternodes, useImportedMasternodeKeys, useMasternodes } from '@renderer/hooks/useMasternodes'
import type { DetectedMasternodeKeyItem } from '@renderer/types/MasternodeKeyDetection'
import type { KeyImportNotice, ManageMasternodeKeysModalProps } from '@renderer/types/MasternodeNodes'
import { countLabel } from '@renderer/utils/countLabel'
import { getErrorMessage } from '@renderer/utils/error'
import {
  detectedNetworkMismatchMessage,
  detectMasternodePrivateKeys,
  importRoleButtonLabel,
} from '@renderer/utils/masternodeKeyDetection'
import { importedKeyStatusMessage } from '@renderer/utils/masternodeNodes'

export default function ManageMasternodeKeysModal({
  walletId,
  open,
  onClose,
}: ManageMasternodeKeysModalProps): React.JSX.Element {
  const inputId = useId()
  const { status } = useAuth()
  const walletNetwork = status?.network ?? null
  const { desired, setDesired } = useConnectionModeContext()
  const { nodes } = useMasternodes(walletId)
  const { importedKeys, loading: keysLoading, err: keysError } = useImportedMasternodeKeys(walletId)
  const [roleOverrides, setRoleOverrides] = useState<Record<string, 'owner' | 'voting'>>({})
  const [privateKeysInput, setPrivateKeysInput] = useState('')
  const [masked, setMasked] = useState(true)
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [removingKeyId, setRemovingKeyId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<KeyImportNotice | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeNotice, setRemoveNotice] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    requestIdRef.current += 1
    setRoleOverrides({})
    setPrivateKeysInput('')
    setMasked(true)
    setPassword('')
    setPasswordInvalid(false)
    setSubmitting(false)
    setRemovingKeyId(null)
    setImportError(null)
    setImportNotice(null)
    setRemoveError(null)
    setRemoveNotice(null)
    return () => {
      requestIdRef.current += 1
    }
  }, [walletId, open])

  const detectedItems = useMemo(
    () => detectMasternodePrivateKeys(privateKeysInput, walletNetwork, nodes, importedKeys),
    [privateKeysInput, walletNetwork, nodes, importedKeys],
  )

  const resolveRole = (item: DetectedMasternodeKeyItem): MasternodeKeyRole | null => {
    if (item.detection.kind === 'bls') return 'operator'
    if (item.detection.kind === 'wif') {
      return roleOverrides[item.id] ?? item.detection.matchedRole ?? 'owner'
    }
    return null
  }

  const validItems = useMemo(
    () => detectedItems.filter(item => item.detection.kind === 'bls' || (item.detection.kind === 'wif' && !item.detection.networkMismatch)),
    [detectedItems],
  )

  const hasInvalidItem = detectedItems.some(item => item.detection.kind === 'invalid' || (item.detection.kind === 'wif' && item.detection.networkMismatch))
  const busy = submitting || removingKeyId !== null
  const hasDraft = detectedItems.length > 0 || privateKeysInput.trim().length > 0
  const canImport = !busy && validItems.length > 0 && password.length > 0

  const resetDraft = (): void => {
    setPrivateKeysInput('')
    setRoleOverrides({})
    setPassword('')
    setPasswordInvalid(false)
    setImportError(null)
    setImportNotice(null)
  }

  const handleImport = async (): Promise<void> => {
    if (!canImport) return
    const requestId = ++requestIdRef.current
    setSubmitting(true)
    setPasswordInvalid(false)
    setImportError(null)
    setImportNotice(null)
    setRemoveError(null)
    setRemoveNotice(null)
    try {
      const valid = await API.verifyWalletPassword(walletId, password)
      if (!valid) {
        if (requestId === requestIdRef.current) setPasswordInvalid(true)
        return
      }
      const matchedHashes = new Set<string>()
      let anyRpcOwnerUnmatched = false
      let anyNullMatch = false
      const importedList: { role: MasternodeKeyRole; key: string }[] = []

      for (const item of validItems) {
        const role = resolveRole(item)
        if (role == null || (item.detection.kind !== 'bls' && item.detection.kind !== 'wif')) continue
        importedList.push({ role, key: item.detection.normalizedKey })
      }

      if (importedList.length === 1) {
        const matched = await API.importMasternodeKey(walletId, importedList[0].role, importedList[0].key, password)
        await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
        if (requestId === requestIdRef.current) {
          setImportNotice({
            tone: desired === 'rpc' && importedList[0].role === 'owner' && matched != null && matched.length === 0
              ? AlertTone.Info
              : AlertTone.Success,
            message: importedKeyStatusMessage(matched, desired, importedList[0].role),
          })
          setPrivateKeysInput('')
          setRoleOverrides({})
          setPassword('')
        }
        return
      }

      for (const entry of importedList) {
        const matched = await API.importMasternodeKey(walletId, entry.role, entry.key, password)
        if (matched == null) anyNullMatch = true
        else {
          for (const node of matched) matchedHashes.add(node.proTxHash)
          if (desired === 'rpc' && entry.role === 'owner' && matched.length === 0) anyRpcOwnerUnmatched = true
        }
      }
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      if (requestId === requestIdRef.current) {
        const base = MANAGE_KEYS_COPY.multiImportedNoticeTemplate.replace('{count}', String(importedList.length))
        const message = anyNullMatch
          ? base
          : `${base} (${countLabel(matchedHashes.size, NODE_MATCHED_FORMS)})`
        setImportNotice({
          tone: anyRpcOwnerUnmatched ? AlertTone.Info : AlertTone.Success,
          message: anyRpcOwnerUnmatched ? `${message} — ${MANAGE_KEYS_COPY.keySavedForP2PNotice}` : message,
        })
        setPrivateKeysInput('')
        setRoleOverrides({})
        setPassword('')
      }
    } catch (err) {
      if (requestId === requestIdRef.current) setImportError(getErrorMessage(err))
    } finally {
      if (requestId === requestIdRef.current) setSubmitting(false)
    }
  }

  const handleRemove = async (key: ImportedMasternodeKeyDto): Promise<void> => {
    if (busy) return
    const id = `${key.role}:${key.publicKey}`
    const requestId = ++requestIdRef.current
    setRemovingKeyId(id)
    setRemoveError(null)
    setRemoveNotice(null)
    setImportNotice(null)
    try {
      await API.removeMasternodeKey(walletId, key)
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      if (requestId === requestIdRef.current) setRemoveNotice(MANAGE_KEYS_COPY.keyRemovedNotice)
    } catch (err) {
      if (requestId === requestIdRef.current) setRemoveError(getErrorMessage(err))
    } finally {
      if (requestId === requestIdRef.current) setRemovingKeyId(null)
    }
  }

  let primaryImportLabel: string = MANAGE_KEYS_COPY.importButton
  if (validItems.length === 1) {
    const role = resolveRole(validItems[0])
    if (role != null) primaryImportLabel = importRoleButtonLabel(role)
  } else if (validItems.length > 1) {
    primaryImportLabel = MANAGE_KEYS_COPY.importMultipleButton.replace('{count}', String(validItems.length))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={MANAGE_KEYS_COPY.title}
      description={MANAGE_KEYS_COPY.description}
      size={ModalSize.Lg}
      dismissible={!busy}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleImport()
        }}
        className={`mt-4 flex flex-col gap-3 ${SURFACE_SECTION}`}
      >
        <div className={'flex flex-col gap-1.5'}>
          <div className={'flex items-center justify-between gap-2'}>
            <label htmlFor={inputId}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.privateKeyLabel}</Text>
            </label>
            <button
              type={'button'}
              onClick={() => setMasked(current => !current)}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 ${CHIP_ACTION}`}
            >
              {masked ? <EyeOpenIcon size={12} color={'currentColor'} /> : <EyeClosedIcon size={12} color={'currentColor'} />}
              <span>{masked ? MANAGE_KEYS_COPY.showKeys : MANAGE_KEYS_COPY.hideKeys}</span>
            </button>
          </div>
          <div className={`w-full flex flex-col items-stretch py-3 ${FIELD_COMPACT} ${importError || hasInvalidItem ? FIELD_INVALID : ''}`}>
            <textarea
              id={inputId}
              rows={3}
              value={privateKeysInput}
              onChange={(event) => {
                setImportError(null)
                setImportNotice(null)
                setPrivateKeysInput(event.target.value)
              }}
              placeholder={MANAGE_KEYS_COPY.privateKeyPlaceholder}
              autoComplete={'off'}
              autoCorrect={'off'}
              autoCapitalize={'off'}
              spellCheck={false}
              aria-invalid={importError || hasInvalidItem ? true : undefined}
              disabled={busy}
              autoFocus
              style={masked && privateKeysInput.length > 0 ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined}
              className={'min-h-[4.5rem] w-full resize-y bg-transparent p-0 font-mono text-xs leading-relaxed outline-none dash-text-default placeholder:font-sans placeholder:text-sm placeholder:text-current placeholder:opacity-40'}
            />
          </div>
          {!hasDraft && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'leading-[135%]'}>
              {MANAGE_KEYS_COPY.autoDetectHint}
            </Text>
          )}
        </div>

        {detectedItems.length > 0 && (
          <div className={'flex max-h-60 flex-col gap-2 overflow-y-auto scrollbar-custom pr-0.5'}>
            {detectedItems.map((item) => {
              const { detection } = item
              if (detection.kind === 'bls') {
                return (
                  <div key={item.id} className={`flex flex-col gap-2 ${SURFACE_ROW}`}>
                    <div className={'flex flex-wrap items-center justify-between gap-2'}>
                      <CustomBadge variant={'accent'} text={MANAGE_KEYS_COPY.detectedBlsBadge} />
                      {detection.matchedService && (
                        <Text size={12} weight={'medium'} color={'blue-mint'}>
                          {`${MANAGE_KEYS_COPY.matchesRolePrefix} ${MASTERNODE_KEY_ROLE_LABELS.operator} ${MANAGE_KEYS_COPY.matchesNodeSeparator} ${detection.matchedService}`}
                        </Text>
                      )}
                      {detection.alreadyImported && (
                        <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                          {`${MANAGE_KEYS_COPY.alreadyImportedPrefix} ${MASTERNODE_KEY_ROLE_LABELS.operator}`}
                        </Text>
                      )}
                    </div>
                    <div className={'flex flex-col gap-0.5'}>
                      <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.detectedPublicKeyLabel}</Text>
                      <HighlightedIdentifier className={'min-w-0 text-xs!'}>{detection.publicKey}</HighlightedIdentifier>
                    </div>
                    <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                      {MANAGE_KEYS_COPY.detectedOperatorDescription}
                    </Text>
                  </div>
                )
              }

              if (detection.kind === 'wif') {
                const effectiveWifRole = roleOverrides[item.id] ?? detection.matchedRole ?? 'owner'
                return (
                  <div key={item.id} className={`flex flex-col gap-2.5 ${SURFACE_ROW}`}>
                    <div className={'flex flex-wrap items-center justify-between gap-2'}>
                      <div className={'flex items-center gap-1.5'}>
                        <CustomBadge variant={'accent'} text={MANAGE_KEYS_COPY.detectedWifBadge} />
                        <CustomBadge variant={'muted'} text={detection.keyNetwork} />
                      </div>
                      {detection.matchedRole != null && detection.matchedService != null && (
                        <Text size={12} weight={'medium'} color={'blue-mint'}>
                          {`${MANAGE_KEYS_COPY.matchesRolePrefix} ${MASTERNODE_KEY_ROLE_LABELS[detection.matchedRole]} ${MANAGE_KEYS_COPY.matchesNodeSeparator} ${detection.matchedService}`}
                        </Text>
                      )}
                      {detection.alreadyImportedRoles.length > 0 && (
                        <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                          {`${MANAGE_KEYS_COPY.alreadyImportedPrefix} ${detection.alreadyImportedRoles.map(r => MASTERNODE_KEY_ROLE_LABELS[r]).join(', ')}`}
                        </Text>
                      )}
                    </div>

                    <div className={'flex flex-col gap-0.5'}>
                      <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.detectedAddressLabel}</Text>
                      <HighlightedIdentifier className={'min-w-0 text-xs!'}>{detection.address}</HighlightedIdentifier>
                    </div>

                    {detection.networkMismatch && walletNetwork != null ? (
                      <CopyableError message={detectedNetworkMismatchMessage(detection.keyNetwork, walletNetwork)} />
                    ) : (
                      <div className={'flex flex-wrap items-center justify-between gap-2 pt-0.5'}>
                        <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                          {detection.matchedRole == null
                            ? MANAGE_KEYS_COPY.roleLabel
                            : `${MANAGE_KEYS_COPY.roleLabel} (${MASTERNODE_KEY_ROLE_LABELS[detection.matchedRole]})`}
                        </Text>
                        <SegmentedControl
                          appearance={SegmentedControlAppearance.Pill}
                          ariaLabel={`${MANAGE_KEYS_COPY.roleLabel} ${detection.address}`}
                          options={WIF_ROLE_OPTIONS}
                          value={effectiveWifRole}
                          onChange={(next) => {
                            setRoleOverrides(prev => ({ ...prev, [item.id]: next }))
                            setImportError(null)
                            setImportNotice(null)
                          }}
                          disabled={busy}
                        />
                      </div>
                    )}

                    {!detection.networkMismatch && desired === 'rpc' && effectiveWifRole === 'owner' && (
                      <Alert
                        tone={AlertTone.Info}
                        icon={<InfoCircleIcon size={16} color={'currentColor'} />}
                        title={MANAGE_KEYS_COPY.rpcOwnerNoticeTitle}
                        description={MANAGE_KEYS_COPY.rpcOwnerNoticeDescription}
                        actions={(
                          <Button
                            type={'button'}
                            size={'compact'}
                            colorScheme={'lightBlue-mint'}
                            disabled={busy}
                            onClick={() => setDesired('p2p')}
                          >
                            {NODES_TAB_COPY.switchToP2P}
                          </Button>
                        )}
                      />
                    )}
                  </div>
                )
              }

              return <CopyableError key={item.id} message={`${detection.message} (${item.rawToken.slice(0, 12)}${item.rawToken.length > 12 ? '…' : ''})`} />
            })}
          </div>
        )}

        {validItems.length > 0 && (
          <PasswordField
            id={`${inputId}-password`}
            label={MANAGE_KEYS_COPY.authorizeLabel}
            value={password}
            onChange={(value) => {
              setPasswordInvalid(false)
              setImportError(null)
              setPassword(value)
            }}
            onSubmit={() => { void handleImport() }}
            error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
            disabled={busy}
            autoFocus={false}
          />
        )}

        {importError && <CopyableError message={importError} />}

        {importNotice && (
          <Alert
            tone={importNotice.tone}
            icon={importNotice.tone === AlertTone.Info
              ? <InfoCircleIcon size={16} color={'currentColor'} />
              : <CheckIcon size={16} color={'currentColor'} className={'[&_circle]:hidden'} />}
            title={importNotice.message}
          />
        )}
      </form>

      <div className={'mt-4 flex flex-col gap-2'}>
        <div className={'flex items-center justify-between gap-2 px-1'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.importedTitle}</Text>
          {importedKeys.length > 0 && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>
              {importedKeys.length}
            </Text>
          )}
        </div>

        {removeError && <CopyableError message={removeError} />}

        {removeNotice && (
          <Alert
            tone={AlertTone.Success}
            icon={<CheckIcon size={16} color={'currentColor'} className={'[&_circle]:hidden'} />}
            title={removeNotice}
          />
        )}

        {keysLoading && importedKeys.length === 0 ? (
          <ListSkeleton rows={2} rowClassName={'h-11 rounded-[.875rem]'} />
        ) : keysError != null && importedKeys.length === 0 ? (
          <div className={SURFACE_SECTION}>
            <CopyableError message={keysError} />
          </div>
        ) : importedKeys.length === 0 ? (
          <div className={SURFACE_SECTION}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.noImportedKeys}</Text>
          </div>
        ) : (
          <div className={'flex max-h-56 flex-col gap-1.5 overflow-y-auto'}>
            {importedKeys.map((item) => {
              const id = `${item.role}:${item.publicKey}`
              const removing = removingKeyId === id
              return (
                <div key={id} className={`flex items-center justify-between gap-3 ${SURFACE_ROW}`}>
                  <div className={'flex min-w-0 flex-1 items-center gap-2.5'}>
                    <CustomBadge variant={'accent'} text={MASTERNODE_KEY_ROLE_LABELS[item.role]} className={'shrink-0'} />
                    <HighlightedIdentifier className={'min-w-0 font-medium!'}>{item.publicKey}</HighlightedIdentifier>
                  </div>
                  <button
                    type={'button'}
                    aria-label={MANAGE_KEYS_COPY.remove}
                    title={MANAGE_KEYS_COPY.remove}
                    disabled={busy}
                    onClick={() => { void handleRemove(item) }}
                    className={'size-6 shrink-0 rounded-[.375rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:pointer-events-none disabled:opacity-40'}
                  >
                    {removing
                      ? <Spinner size={10} className={'dash-text-default opacity-50'} />
                      : <DeleteIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasDraft ? (
        <ModalActions
          secondary={{
            label: MANAGE_KEYS_COPY.clear,
            onClick: resetDraft,
            disabled: busy,
          }}
          primary={{
            label: submitting ? MANAGE_KEYS_COPY.importing : primaryImportLabel,
            onClick: () => { void handleImport() },
            disabled: !canImport,
            loading: submitting,
          }}
        />
      ) : (
        <div className={'mt-6 flex'}>
          <Button
            type={'button'}
            onClick={onClose}
            disabled={busy}
            variant={'outline'}
            colorScheme={'primary-light'}
            size={'sm'}
            className={'flex-1 rounded-[.9375rem]'}
          >
            {MANAGE_KEYS_COPY.close}
          </Button>
        </div>
      )}
    </Modal>
  )
}
