import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon } from '../dash-ui-kit-extended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { PlatformSendResult } from '@renderer/api/types'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import { getErrorMessage } from '@renderer/utils/error'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'
import PendingRow from '@renderer/components/ui/PendingRow'
import { toast } from '@renderer/components/ui/Toast'
import HashField from '@renderer/components/ui/HashField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import TxSummary from '@renderer/components/ui/TxSummary'
import type { RecipientSummaryProps } from '@renderer/types/RecipientSummary'
import type { TransferConfirmModalProps } from '@renderer/types/TransferConfirmModal'
import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SEND_BROADCASTING_LABEL, SEND_CANCEL_DELAY_MS, SEND_INPUTS_CHANGED_MESSAGE } from '@renderer/constants/sendConfirmModal'

export default function TransferConfirmModal({
  isOpen,
  advanced = true,
  onClose,
  title,
  successTitle,
  summary,
  recipients,
  feeOutputIndex,
  feeCredits,
  run,
  sourceValid = true,
  presetPassword,
  onSuccess,
  successNote,
}: TransferConfirmModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const { status } = useAuth()
  const network = status?.network ?? null
  const walletId = status?.selectedWalletId ?? null
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<ConfirmModalPhase>(ConfirmModalPhase.Confirm)
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [result, setResult] = useState<PlatformSendResult | null>(null)
  const [sentRecipients, setSentRecipients] = useState<RecipientSummaryProps | null>(null)
  const [auto, setAuto] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const autoStarted = useRef(false)
  const runId = useRef(0)
  const [seenOpen, setSeenOpen] = useState(false)

  if (isOpen !== seenOpen) {
    setSeenOpen(isOpen)
    if (isOpen) {
      setPassword('')
      setPhase(presetPassword ? ConfirmModalPhase.Sending : ConfirmModalPhase.Confirm)
      setPasswordInvalid(false)
      setResult(null)
      setSentRecipients(null)
      setAuto(Boolean(presetPassword))
      setCanCancel(false)
    }
  }

  const abort = (preset: boolean): void => {
    setCanCancel(false)
    if (preset) onClose()
    else setPhase(ConfirmModalPhase.Confirm)
  }

  const submit = async (secret: string, preset: boolean): Promise<void> => {
    if (!sourceValidRef.current) {
      if (preset) toast.error(SEND_INPUTS_CHANGED_MESSAGE)
      abort(preset)
      return
    }
    const id = ++runId.current
    setCanCancel(false)
    try {
      setSentRecipients(recipients ? {
        recipients: recipients.map(recipient => ({ ...recipient })),
        feeOutputIndex,
        feeCredits,
      } : null)
      const res = await run(secret)
      if (runId.current !== id) {
        onSuccess()
        return
      }
      setCanCancel(false)
      setResult(res)
      setPhase(ConfirmModalPhase.Done)
      onSuccess()
    } catch (e) {
      if (runId.current !== id) return
      console.error('Transfer failed', e)
      toast.error(getErrorMessage(e))
      abort(preset)
    }
  }

  const sending = phase === ConfirmModalPhase.Sending

  useEffect(() => {
    if (!isOpen || !sending) {
      setCanCancel(false)
      return
    }
    const timer = setTimeout(() => setCanCancel(true), SEND_CANCEL_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isOpen, sending])

  useEffect(() => {
    if (!isOpen) {
      runId.current++
      autoStarted.current = false
      return
    }
    if (autoStarted.current) return
    if (presetPassword) {
      autoStarted.current = true
      void submit(presetPassword, true)
    }
  }, [isOpen])

  const cancelAllowed = !sending || canCancel

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || sending || !sourceValidRef.current) return
    const id = ++runId.current
    setPhase(ConfirmModalPhase.Sending)
    setPasswordInvalid(false)
    setCanCancel(false)
    try {
      const valid = await API.verifyWalletPassword(walletId, password)
      if (runId.current !== id) return
      if (valid) {
        await submit(password, false)
        return
      }
      setPasswordInvalid(true)
    } catch (e) {
      if (runId.current !== id) return
      console.error('Transfer failed', e)
      toast.error(getErrorMessage(e))
    }
    setCanCancel(false)
    setPhase(ConfirmModalPhase.Confirm)
  }

  const requestClose = (): void => {
    if (!cancelAllowed) return
    runId.current++
    setCanCancel(false)
    if (sending) setPhase(ConfirmModalPhase.Confirm)
    onClose()
  }

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      title={phase === ConfirmModalPhase.Done ? successTitle : title}
      size={ModalSize.Lg}
      dismissible={cancelAllowed}
    >
      {phase !== ConfirmModalPhase.Done ? auto ? (
        <div className={"phase-fade-in"} key={"pending"}>
          <PendingRow label={SEND_BROADCASTING_LABEL} className={"mt-4"} />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary {...summary} className={"mt-4"} />

          <PasswordField
            id={"transfer-confirm-password"}
            value={password}
            onChange={(value) => { setPasswordInvalid(false); setPassword(value) }}
            onSubmit={handleConfirm}
            error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
            disabled={sending}
            className={"mt-5"}
          />

          <ModalActions
            secondary={{ label: 'Cancel', onClick: requestClose, disabled: !cancelAllowed }}
            primary={{
              label: sending ? 'Sending…' : advanced ? 'Sign & Send' : 'Confirm',
              onClick: handleConfirm,
              disabled: password.length === 0 || !sourceValid,
              loading: sending,
            }}
          />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"done"}>
          <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
            <div className={"success-pop"}>
              <SuccessIcon size={56} />
            </div>
            <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>
              {result ? <CreditsAmount credits={result.amountCredits} align={"center"} /> : ''}
            </Text>
            {successNote && (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                {successNote}
              </Text>
            )}
          </div>

          <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
            <div className={"flex justify-between items-center gap-4"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>From</Text>
              <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all select-all text-right"}>{result?.fromAddress}</Text>
            </div>
            {sentRecipients ? <RecipientSummary {...sentRecipients} feeCredits={result?.feeCredits ?? sentRecipients.feeCredits} /> : <div className={"flex justify-between items-center gap-4"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To</Text>
              <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all select-all text-right"}>{result?.toAddress}</Text>
            </div>}
            {result?.feeCredits != null && (
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  {sentRecipients?.feeOutputIndex === undefined ? 'Reserved for fee' : `Fee reserve from recipient ${sentRecipients.feeOutputIndex + 1}`}
                </Text>
                <Text size={12} weight={"medium"} color={"brand"}><CreditsAmount credits={result.feeCredits} align={"end"} /></Text>
              </div>
            )}
            {result?.stHash && <HashField hash={result.stHash} explorerUrl={network ? platformTransactionUrl(result.stHash, network) : null} />}
          </div>

          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
