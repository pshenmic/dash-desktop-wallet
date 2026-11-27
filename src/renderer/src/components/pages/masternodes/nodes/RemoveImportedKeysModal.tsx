import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CheckRow from '@renderer/components/ui/CheckRow'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import {
  MASTERNODE_KEY_ROLE_LABELS,
  REMOVE_IMPORTED_KEYS_COPY,
  UNMATCHED_IMPORTED_KEYS_COPY,
} from '@renderer/constants/masternodeNodes'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import {
  refreshImportedMasternodeKeys,
  refreshMasternodes,
  refreshUnmatchedImportedMasternodeKeys,
} from '@renderer/hooks/useMasternodes'
import type { RemoveImportedKeysModalProps } from '@renderer/types/MasternodeNodes'
import { getErrorMessage } from '@renderer/utils/error'
import { importedKeyRowId, removeImportedKeysConfirmLabel } from '@renderer/utils/masternodeNodes'

export default function RemoveImportedKeysModal({
  walletId,
  node,
  matchedKeys,
  open,
  onClose,
  onNodeRemoved,
}: RemoveImportedKeysModalProps): React.JSX.Element {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => matchedKeys.map(importedKeyRowId))
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true
      setSelectedIds(matchedKeys.map(importedKeyRowId))
      setRemoving(false)
      setError(null)
      return
    }
    const validIds = new Set(matchedKeys.map(importedKeyRowId))
    setSelectedIds((prev) => {
      const next = prev.filter(id => validIds.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [open, matchedKeys])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedKeys = useMemo(
    () => matchedKeys.filter(key => selectedSet.has(importedKeyRowId(key))),
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
    let succeeded = false
    try {
      for (const key of selectedKeys) {
        await API.removeMasternodeKey(walletId, key)
      }
      succeeded = true
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      await Promise.all([
        refreshImportedMasternodeKeys(walletId),
        refreshUnmatchedImportedMasternodeKeys(walletId),
        refreshMasternodes(walletId),
      ]).catch(() => {})
      setRemoving(false)
    }
    if (succeeded) {
      const latest = await API.getMasternodes(walletId).catch(() => null)
      onClose()
      if (latest != null && !latest.some(entry => entry.proTxHash === node.proTxHash)) {
        onNodeRemoved()
      }
    }
  }

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
                  onClick={() => setSelectedIds(matchedKeys.map(importedKeyRowId))}
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
              const id = importedKeyRowId(item)
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
                    {!item.hasPrivateKey && (
                      <CustomBadge variant={'muted'} text={UNMATCHED_IMPORTED_KEYS_COPY.watchOnlyBadge} className={'shrink-0'} />
                    )}
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
          label: removeImportedKeysConfirmLabel(selectedKeys.length, removing),
          onClick: () => { void handleConfirm() },
          disabled: selectedKeys.length === 0 || removing,
          loading: removing,
        }}
      />
    </Modal>
  )
}
