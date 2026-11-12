import { useState } from 'react'
import { API } from '@renderer/api'
import type { MasternodeUpdateResult, RevocationReason } from '@renderer/api/types'
import { HighlightedIdentifier, InfoCircleIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import Alert from '@renderer/components/ui/Alert'
import DropdownField from '@renderer/components/ui/DropdownField'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  REGISTER_MASTERNODE_COPY,
  REVOCATION_REASON_OPTIONS,
  REVOKE_MASTERNODE_COPY,
} from '@renderer/constants/masternodeNodes'
import { FIELD_COMPACT, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { refreshMasternodes } from '@renderer/hooks/useMasternodes'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import type { RevokeMasternodeModalProps } from '@renderer/types/MasternodeNodes'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'

export default function RevokeMasternodeModal({
  walletId,
  node,
  open,
  onClose,
}: RevokeMasternodeModalProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const [reason, setReason] = useState<RevocationReason>('notSpecified')

  const run = async (password: string): Promise<MasternodeUpdateResult> => {
    const result = await API.revokeMasternode(walletId, node.proTxHash, reason, password)
    void refreshMasternodes(walletId)
    void refreshBalance(walletId)
    return result
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <Alert
        tone={AlertTone.Warning}
        icon={<InfoCircleIcon size={14} />}
        title={REVOKE_MASTERNODE_COPY.warningTitle}
        description={REVOKE_MASTERNODE_COPY.warningDescription}
      />

      <div className={'flex flex-col gap-1.5'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REVOKE_MASTERNODE_COPY.reasonLabel}</Text>
        <DropdownField
          options={REVOCATION_REASON_OPTIONS}
          value={reason}
          onChange={val => setReason(val as RevocationReason)}
          ariaLabel={REVOKE_MASTERNODE_COPY.reasonLabel}
          triggerClassName={FIELD_COMPACT}
        />
      </div>
    </div>
  )

  const selectedReasonLabel = REVOCATION_REASON_OPTIONS.find(o => o.value === reason)?.label ?? reason

  return (
    <SignedActionModal<MasternodeUpdateResult>
      open={open}
      onClose={onClose}
      title={REVOKE_MASTERNODE_COPY.title}
      description={REVOKE_MASTERNODE_COPY.description}
      edit={{
        content: editContent,
        continueLabel: REVOKE_MASTERNODE_COPY.review,
        canContinue: true,
      }}
      summary={
        <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.proTxHashLabel}</Text>
            <HighlightedIdentifier className={'min-w-0 text-xs!'}>{node.proTxHash}</HighlightedIdentifier>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REVOKE_MASTERNODE_COPY.reasonLabel}</Text>
            <Text size={12} weight={'extrabold'} color={'brand'}>{selectedReasonLabel}</Text>
          </div>
        </div>
      }
      confirmLabel={REVOKE_MASTERNODE_COPY.confirm}
      pendingLabel={REVOKE_MASTERNODE_COPY.pending}
      run={run}
      renderDone={result => ({
        headline: REVOKE_MASTERNODE_COPY.doneHeadline,
        details: [
          { label: REGISTER_MASTERNODE_COPY.networkFee, value: `${davToDash(result.fee)} ${DASH_UNIT}` },
          { label: REGISTER_MASTERNODE_COPY.peersAcked, value: String(result.peersAcked) },
        ],
        hash: {
          value: result.txid,
          label: REVOKE_MASTERNODE_COPY.txidLabel,
          explorerUrl: network == null ? null : transactionUrl(result.txid, network),
        },
      })}
    />
  )
}
