import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { ImportedMasternodeKeyDto } from '@renderer/api/types'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CheckRow from '@renderer/components/ui/CheckRow'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { MASTERNODE_KEY_ROLE_LABELS, REMOVE_IMPORTED_KEYS_COPY } from '@renderer/constants/masternodeNodes'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { refreshImportedMasternodeKeys, refreshMasternodes } from '@renderer/hooks/useMasternodes'
import type { RemoveImportedKeysModalProps } from '@renderer/types/MasternodeNodes'
import { getErrorMessage } from '@renderer/utils/error'

function keyId(key: ImportedMasternodeKeyDto): string {
  return `${key.role}:${key.publicKey}`
}

export default function RemoveImportedKeysModal({
  walletId,
  node,
  matchedKeys,
  open,
  onClose,
  onNodeRemoved,
}: RemoveImportedKeysModalProps): React.JSX.Element {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => matchedKeys.map(keyId))
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedIds(matchedKeys.map(keyId))
    setRemoving(false)
    setError(null)
  }, [open, matchedKeys])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedKeys = useMemo(
    () => matchedKeys.filter(key => selectedSet.has(keyId(key))),
    [matchedKeys, selectedSet],
  )

  const toggleKey = (id: string, checked: boolean): void => {
    setError(null)
    setSelectedIds(prev => (checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter(item => item !== id)))
  }

  const handleConfirm = async (): Promise<void> => {
    if (removing || selectedKeys.length === 0) return
    setRemoving(true)
    setError(null)
    try {
      for (const key of selectedKeys) {
        await API.removeMasternodeKey(walletId, key)
      }
      await Promise.all([refreshImportedMasternodeKeys(walletId), refreshMasternodes(walletId)])
      const latest = await API.getMasternodes(walletId).catch(() => null)
      onClose()
      if (latest != null && !latest.some(entry => entry.proTxHash === node.proTxHash)) {
        onNodeRemoved()
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRemoving(false)
    }
  }

  const confirmLabel = removing
    ? REMOVE_IMPORTED_KEYS_COPY.removing
    : selectedKeys.length === 1
      ? REMOVE_IMPORTED_KEYS_COPY.confirmSingle
      : REMOVE_IMPORTED_KEYS_COPY.confirmPlural.replace('{count}', String(selectedKeys.length))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={REMOVE_IMPORTED_KEYS_COPY.title}
      description={REMOVE_IMPORTED_KEYS_COPY.description}
      size={ModalSize.Md}
      dismissible={!removing}
    >
      <div className={'mt-4 flex flex-col gap-3'}>
        <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
          <div className={'flex items-center justify-between gap-2'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {REMOVE_IMPORTED_KEYS_COPY.keysLabel}
            </Text>
            {matchedKeys.length > 1 && (
              <div className={'flex items-center gap-1.5'}>
                <button
                  type={'button'}
                  disabled={removing}
                  onClick={() => setSelectedIds(matchedKeys.map(keyId))}
                  className={CHIP_ACTION}
                >
                  {REMOVE_IMPORTED_KEYS_COPY.selectAll}
                </button>
                <button
                  type={'button'}
                  disabled={removing || selectedKeys.length === 0}
                  onClick={() => setSelectedIds([])}
                  className={CHIP_ACTION}
                >
                  {REMOVE_IMPORTED_KEYS_COPY.clear}
                </button>
              </div>
            )}
          </div>

          <div className={'flex max-h-56 flex-col gap-1.5 overflow-y-auto scrollbar-custom'}>
            {matchedKeys.map((item) => {
              const id = keyId(item)
              return (
                <CheckRow
                  key={id}
                  label={`${MASTERNODE_KEY_ROLE_LABELS[item.role]} ${item.publicKey}`}
                  checked={selectedSet.has(id)}
                  disabled={removing}
                  dimChildren={false}
                  onChange={checked => toggleKey(id, checked)}
                >
                  <div className={'flex min-w-0 items-center gap-2'}>
                    <CustomBadge variant={'accent'} text={MASTERNODE_KEY_ROLE_LABELS[item.role]} className={'shrink-0'} />
                    <HighlightedIdentifier className={'min-w-0 text-xs! font-medium!'}>{item.publicKey}</HighlightedIdentifier>
                  </div>
                </CheckRow>
              )
            })}
          </div>
        </div>

        {error != null && <CopyableError message={error} />}
      </div>

      <ModalActions
        tone={ModalActionTone.Danger}
        secondary={{
          label: REMOVE_IMPORTED_KEYS_COPY.cancel,
          onClick: onClose,
          disabled: removing,
        }}
        primary={{
          label: confirmLabel,
          onClick: () => { void handleConfirm() },
          disabled: selectedKeys.length === 0 || removing,
          loading: removing,
        }}
      />
    </Modal>
  )
}
