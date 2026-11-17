import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button, CheckIcon, DeleteIcon, HighlightedIdentifier, InfoCircleIcon, Input, Text } from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import Spinner from '@renderer/components/ui/Spinner'
import { API } from '@renderer/api'
import type { ImportedMasternodeKeyDto, MasternodeKeyRole } from '@renderer/api/types'
import { WIF_ROLE_OPTIONS } from '@renderer/constants/masternodeKeys'
import {
  MANAGE_KEYS_COPY,
  MASTERNODE_KEY_ROLE_LABELS,
  NODES_TAB_COPY,
} from '@renderer/constants/masternodeNodes'
import { PASSWORD_FIELD_INPUT_CLASS } from '@renderer/constants/password'
import { SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshImportedMasternodeKeys, refreshMasternodes, useImportedMasternodeKeys, useMasternodes } from '@renderer/hooks/useMasternodes'
import type { KeyImportNotice, ManageMasternodeKeysModalProps } from '@renderer/types/MasternodeNodes'
import { getErrorMessage } from '@renderer/utils/error'
import {
  detectedNetworkMismatchMessage,
  detectMasternodePrivateKey,
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
  const [wifRole, setWifRole] = useState<'owner' | 'voting'>('owner')
  const [wifRoleOverridden, setWifRoleOverridden] = useState(false)
  const [privateKey, setPrivateKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [removingKeyId, setRemovingKeyId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<KeyImportNotice | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeNotice, setRemoveNotice] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    requestIdRef.current += 1
    setWifRole('owner')
    setWifRoleOverridden(false)
    setPrivateKey('')
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

  const detection = useMemo(
    () => detectMasternodePrivateKey(privateKey, walletNetwork, nodes, importedKeys),
    [privateKey, walletNetwork, nodes, importedKeys],
  )

  const effectiveRole: MasternodeKeyRole | null = detection.kind === 'bls'
    ? 'operator'
    : detection.kind === 'wif'
      ? (wifRoleOverridden ? wifRole : (detection.matchedRole ?? wifRole))
      : null

  const busy = submitting || removingKeyId !== null
  const hasDraft = detection.kind !== 'empty'
  const canImport = !busy && (
    detection.kind === 'bls'
    || (detection.kind === 'wif' && !detection.networkMismatch)
  )

  const resetDraft = (): void => {
    setPrivateKey('')
    setWifRoleOverridden(false)
    setImportError(null)
    setImportNotice(null)
  }

  const handleImport = async (): Promise<void> => {
    if (!canImport || effectiveRole == null) return
    const keyToImport = detection.kind === 'bls' || detection.kind === 'wif' ? detection.normalizedKey : ''
    if (keyToImport === '') return
    const requestId = ++requestIdRef.current
    setSubmitting(true)
    setImportError(null)
    setImportNotice(null)
    setRemoveError(null)
    setRemoveNotice(null)
    try {
      const matched = await API.importMasternodeKey(walletId, effectiveRole, keyToImport)
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      if (requestId === requestIdRef.current) {
        setImportNotice({
          tone: desired === 'rpc' && effectiveRole === 'owner' && matched != null && matched.length === 0
            ? AlertTone.Info
            : AlertTone.Success,
          message: importedKeyStatusMessage(matched, desired, effectiveRole),
        })
        setPrivateKey('')
        setWifRoleOverridden(false)
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

  const primaryImportLabel = effectiveRole != null
    ? importRoleButtonLabel(effectiveRole)
    : MANAGE_KEYS_COPY.importButton

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
          <label htmlFor={inputId}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.privateKeyLabel}</Text>
          </label>
          <Input
            id={inputId}
            type={'password'}
            value={privateKey}
            onChange={(event) => {
              setImportError(null)
              setImportNotice(null)
              setWifRoleOverridden(false)
              setPrivateKey(event.target.value)
            }}
            placeholder={MANAGE_KEYS_COPY.privateKeyPlaceholder}
            autoComplete={'off'}
            autoCorrect={'off'}
            autoCapitalize={'off'}
            spellCheck={false}
            variant={'outlined'}
            colorScheme={importError || detection.kind === 'invalid' || (detection.kind === 'wif' && detection.networkMismatch) ? 'error' : 'primary'}
            className={PASSWORD_FIELD_INPUT_CLASS}
            aria-invalid={importError || detection.kind === 'invalid' ? true : undefined}
            disabled={busy}
            autoFocus
          />
          {!hasDraft && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'leading-[135%]'}>
              {MANAGE_KEYS_COPY.autoDetectHint}
            </Text>
          )}
        </div>

        {detection.kind === 'bls' && (
          <div className={`flex flex-col gap-2 ${SURFACE_ROW}`}>
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
        )}

        {detection.kind === 'wif' && (
          <div className={`flex flex-col gap-2.5 ${SURFACE_ROW}`}>
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
                  ariaLabel={MANAGE_KEYS_COPY.roleLabel}
                  options={WIF_ROLE_OPTIONS}
                  value={effectiveRole === 'voting' ? 'voting' : 'owner'}
                  onChange={(next) => {
                    setWifRole(next)
                    setWifRoleOverridden(true)
                    setImportError(null)
                    setImportNotice(null)
                  }}
                  disabled={busy}
                />
              </div>
            )}

            {!detection.networkMismatch && desired === 'rpc' && effectiveRole === 'owner' && (
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
        )}

        {detection.kind === 'invalid' && <CopyableError message={detection.message} />}

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
