import { useEffect, useId, useRef, useState } from 'react'
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
import {
  MANAGE_KEYS_COPY,
  MASTERNODE_KEY_ROLE_HINTS,
  MASTERNODE_KEY_ROLE_LABELS,
  MASTERNODE_KEY_ROLE_OPTIONS,
  NODES_TAB_COPY,
} from '@renderer/constants/masternodeNodes'
import { PASSWORD_FIELD_INPUT_CLASS } from '@renderer/constants/password'
import { SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshImportedMasternodeKeys, refreshMasternodes, useImportedMasternodeKeys } from '@renderer/hooks/useMasternodes'
import type { KeyImportNotice, ManageMasternodeKeysModalProps } from '@renderer/types/MasternodeNodes'
import { getErrorMessage } from '@renderer/utils/error'
import { importedKeyStatusMessage } from '@renderer/utils/masternodeNodes'

export default function ManageMasternodeKeysModal({
  walletId,
  open,
  onClose,
}: ManageMasternodeKeysModalProps): React.JSX.Element {
  const inputId = useId()
  const { desired, setDesired } = useConnectionModeContext()
  const { importedKeys, loading: keysLoading, err: keysError } = useImportedMasternodeKeys(walletId)
  const [role, setRole] = useState<MasternodeKeyRole>('owner')
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
    setRole('owner')
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

  const busy = submitting || removingKeyId !== null
  const trimmed = privateKey.trim()
  const canImport = trimmed.length > 0 && !busy

  const handleImport = async (): Promise<void> => {
    if (!canImport) return
    const requestId = ++requestIdRef.current
    setSubmitting(true)
    setImportError(null)
    setImportNotice(null)
    setRemoveError(null)
    setRemoveNotice(null)
    try {
      const matched = await API.importMasternodeKey(walletId, role, trimmed)
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      if (requestId === requestIdRef.current) {
        setImportNotice({
          tone: desired === 'rpc' && role === 'owner' && matched != null && matched.length === 0
            ? AlertTone.Info
            : AlertTone.Success,
          message: importedKeyStatusMessage(matched, desired, role),
        })
        setPrivateKey('')
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
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.roleLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={MANAGE_KEYS_COPY.roleLabel}
            options={MASTERNODE_KEY_ROLE_OPTIONS}
            value={role}
            onChange={(next) => {
              setRole(next)
              setImportError(null)
              setImportNotice(null)
            }}
            disabled={busy}
            className={'self-start flex-wrap'}
          />
        </div>

        {desired === 'rpc' && role === 'owner' && (
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
              setPrivateKey(event.target.value)
            }}
            placeholder={MASTERNODE_KEY_ROLE_HINTS[role]}
            autoComplete={'off'}
            autoCorrect={'off'}
            autoCapitalize={'off'}
            spellCheck={false}
            variant={'outlined'}
            colorScheme={importError ? 'error' : 'primary'}
            className={PASSWORD_FIELD_INPUT_CLASS}
            aria-invalid={importError ? true : undefined}
            disabled={busy}
            autoFocus
          />
        </div>

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

        <div className={'flex justify-end'}>
          <Button
            type={'submit'}
            variant={'solid'}
            colorScheme={'primary'}
            size={'compact'}
            disabled={!canImport}
            className={'inline-flex items-center gap-2 rounded-[.75rem]'}
          >
            {submitting && <Spinner size={14} className={'text-current'} />}
            {submitting ? MANAGE_KEYS_COPY.importing : MANAGE_KEYS_COPY.importButton}
          </Button>
        </div>
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

      <ModalActions primary={{ label: MANAGE_KEYS_COPY.close, onClick: onClose, disabled: busy }} />
    </Modal>
  )
}
