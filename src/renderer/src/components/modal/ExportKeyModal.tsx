import { useEffect, useRef, useState } from 'react'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import Alert from '@renderer/components/ui/Alert'
import CopyButton from '@renderer/components/ui/CopyButton'
import HashField from '@renderer/components/ui/HashField'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'
import { API } from '@renderer/api'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { EXPORT_KEY_COPY } from '@renderer/constants/exportKey'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import type { ExportKeyModalProps, FormattedAddressKey } from '@renderer/types/ExportKey'
import { getErrorMessage } from '@renderer/utils/error'
import { formatAddressKey } from '@renderer/utils/exportKey'

export default function ExportKeyModal({ target, onClose }: ExportKeyModalProps): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState<FormattedAddressKey | null>(null)
  const requestIdRef = useRef(0)

  const canSubmit = walletId != null && target != null && password.length > 0 && !loading

  useEffect(() => {
    requestIdRef.current += 1
    setPassword('')
    setError(null)
    setLoading(false)
    setRevealed(null)
  }, [walletId, target?.address, target?.path])

  const handleReveal = async (): Promise<void> => {
    if (!canSubmit || walletId == null || target == null) return

    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const info = await API.exportKeyByAddress(walletId, target.address, password)
      if (requestId !== requestIdRef.current) return
      setRevealed(formatAddressKey(info))
      setPassword('')
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(getErrorMessage(err))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }

  return (
    <Modal open={target != null} onClose={onClose} title={EXPORT_KEY_COPY.title} size={ModalSize.Lg} dismissible={!loading}>
      <Alert
        tone={AlertTone.Warning}
        icon={<ExclamationIcon size={16} color={"currentColor"} />}
        title={EXPORT_KEY_COPY.warningTitle}
        description={EXPORT_KEY_COPY.warning}
        className={"mt-4"}
      />

      {revealed == null ? (
        <div className={"phase-fade-in"} key={"confirm"}>
          {target && (
            <div className={`mt-4 flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
              <div className={"flex flex-col gap-1"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{EXPORT_KEY_COPY.targetAddressLabel}</Text>
                <div className={"flex min-w-0 items-center gap-2"}>
                  <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{target.address}</HighlightedIdentifier>
                  <CopyButton text={target.address} className={"shrink-0"} />
                </div>
              </div>
              {target.path && (
                <div className={"flex items-center justify-between gap-4"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{EXPORT_KEY_COPY.targetPathLabel}</Text>
                  <Text size={12} weight={"medium"} color={"brand"} className={"font-mono text-[0.6875rem]! select-all"}>
                    {target.path}
                  </Text>
                </div>
              )}
            </div>
          )}

          <PasswordField
            id={"export-key-password"}
            value={password}
            onChange={(value) => {
              setError(null)
              setPassword(value)
            }}
            onSubmit={() => { void handleReveal() }}
            error={error}
            disabled={loading}
            className={"mt-4"}
          />

          <ModalActions
            secondary={{ label: EXPORT_KEY_COPY.cancel, onClick: onClose, disabled: loading }}
            primary={{
              label: loading ? EXPORT_KEY_COPY.revealing : EXPORT_KEY_COPY.reveal,
              onClick: () => { void handleReveal() },
              disabled: !canSubmit,
              loading,
            }}
          />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"revealed"}>
          <div className={"mt-4 flex flex-col gap-3"}>
            <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
              <HashField hash={revealed.address} label={EXPORT_KEY_COPY.targetAddressLabel} />
              <HashField hash={revealed.path} label={EXPORT_KEY_COPY.targetPathLabel} />
              <HashField hash={revealed.publicKeyHex} label={EXPORT_KEY_COPY.publicKeyLabel} />
            </div>
            <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
              <HashField hash={revealed.wif} label={EXPORT_KEY_COPY.wifLabel} copyOnClick={false} />
              <HashField hash={revealed.privateKeyHex} label={EXPORT_KEY_COPY.privateKeyHexLabel} copyOnClick={false} />
            </div>
          </div>

          <ModalActions primary={{ label: EXPORT_KEY_COPY.done, onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
