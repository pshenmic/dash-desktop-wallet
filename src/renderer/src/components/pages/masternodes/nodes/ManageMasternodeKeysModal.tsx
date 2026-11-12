import { useState } from 'react'
import { API } from '@renderer/api'
import type { ImportedMasternodeKeyDto, MasternodeKeyRole } from '@renderer/api/types'
import { Button, HighlightedIdentifier, Input, Text } from '@renderer/components/dash-ui-kit-extended'
import { DeleteIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { toast } from '@renderer/components/ui/Toast'
import {
  MASTERNODE_KEY_ROLE_HINTS,
  MASTERNODE_KEY_ROLE_LABELS,
  MASTERNODE_KEY_ROLE_OPTIONS,
  MANAGE_KEYS_COPY,
} from '@renderer/constants/masternodeNodes'
import { PASSWORD_FIELD_INPUT_CLASS } from '@renderer/constants/password'
import { SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import {
  refreshImportedMasternodeKeys,
  refreshMasternodes,
  useImportedMasternodeKeys,
} from '@renderer/hooks/useMasternodes'
import type { ManageMasternodeKeysModalProps } from '@renderer/types/MasternodeNodes'
import { getErrorMessage } from '@renderer/utils/error'

export default function ManageMasternodeKeysModal({
  walletId,
  open,
  onClose,
}: ManageMasternodeKeysModalProps): React.JSX.Element {
  const { importedKeys } = useImportedMasternodeKeys(walletId)
  const [role, setRole] = useState<MasternodeKeyRole>('voting')
  const [privateKey, setPrivateKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async (): Promise<void> => {
    const trimmed = privateKey.trim()
    if (trimmed === '' || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const matched = await API.importMasternodeKey(walletId, role, trimmed)
      setPrivateKey('')
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      const suffix = matched == null ? '' : ` (${matched.length} node${matched.length === 1 ? '' : 's'} matched)`
      toast.success(`${MANAGE_KEYS_COPY.keyImportedToast}${suffix}`)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (key: ImportedMasternodeKeyDto): Promise<void> => {
    const id = `${key.role}:${key.publicKey}`
    if (removingKey != null) return
    setRemovingKey(id)
    setError(null)
    try {
      await API.removeMasternodeKey(walletId, key)
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      toast.success(MANAGE_KEYS_COPY.keyRemovedToast)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setRemovingKey(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={MANAGE_KEYS_COPY.title}
      description={MANAGE_KEYS_COPY.description}
      size={ModalSize.Lg}
      dismissible={!submitting && removingKey == null}
    >
      <div className={'mt-4 flex flex-col gap-4'}>
        <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={'flex items-center justify-between gap-2'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.roleLabel}</Text>
            <SegmentedControl
              appearance={SegmentedControlAppearance.Pill}
              ariaLabel={MANAGE_KEYS_COPY.roleLabel}
              options={MASTERNODE_KEY_ROLE_OPTIONS}
              value={role}
              onChange={next => { setRole(next); setError(null) }}
            />
          </div>
          <div className={'flex flex-col gap-1.5'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.privateKeyLabel}</Text>
            <div className={'flex items-center gap-2'}>
              <Input
                type={'password'}
                value={privateKey}
                onChange={e => { setPrivateKey(e.target.value); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') void handleImport() }}
                placeholder={MASTERNODE_KEY_ROLE_HINTS[role]}
                variant={'outlined'}
                colorScheme={error ? 'error' : 'primary'}
                className={PASSWORD_FIELD_INPUT_CLASS}
                disabled={submitting}
              />
              <Button
                type={'button'}
                size={'md'}
                colorScheme={'primary'}
                disabled={privateKey.trim() === '' || submitting}
                onClick={() => void handleImport()}
                className={'h-14.25 shrink-0 rounded-[1.25rem]'}
              >
                {submitting ? MANAGE_KEYS_COPY.importing : MANAGE_KEYS_COPY.importButton}
              </Button>
            </div>
          </div>
          {error && <CopyableError message={error} />}
        </div>

        <div className={'flex flex-col gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.importedTitle}</Text>
          {importedKeys.length === 0 ? (
            <div className={SURFACE_SECTION}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{MANAGE_KEYS_COPY.noImportedKeys}</Text>
            </div>
          ) : (
            <div className={'flex max-h-52 flex-col gap-1.5 overflow-y-auto scrollbar-custom'}>
              {importedKeys.map(key => {
                const id = `${key.role}:${key.publicKey}`
                return (
                  <div key={id} className={`flex items-center justify-between gap-3 ${SURFACE_ROW}`}>
                    <div className={'flex min-w-0 items-center gap-2.5'}>
                      <CustomBadge variant={'accent'} text={MASTERNODE_KEY_ROLE_LABELS[key.role]} className={'shrink-0'} />
                      <HighlightedIdentifier className={'min-w-0 text-xs!'}>{key.publicKey}</HighlightedIdentifier>
                    </div>
                    <button
                      type={'button'}
                      onClick={() => void handleRemove(key)}
                      disabled={removingKey != null}
                      title={MANAGE_KEYS_COPY.remove}
                      className={'shrink-0 rounded-lg p-1.5 text-dash-red hover:bg-dash-red/10 transition-colors cursor-pointer disabled:opacity-40'}
                    >
                      <DeleteIcon size={12} color={'currentColor'} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <ModalActions primary={{ label: MANAGE_KEYS_COPY.close, onClick: onClose }} />
      </div>
    </Modal>
  )
}
