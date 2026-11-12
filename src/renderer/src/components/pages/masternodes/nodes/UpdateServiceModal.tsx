import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { MasternodeUpdateResult } from '@renderer/api/types'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import DropdownField from '@renderer/components/ui/DropdownField'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES } from '@renderer/constants/addressField'
import { DASH_UNIT } from '@renderer/constants/balance'
import { REGISTER_MASTERNODE_COPY, UPDATE_SERVICE_COPY } from '@renderer/constants/masternodeNodes'
import {
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  TESTNET_DEFAULT_PLATFORM_HTTP_PORT,
  TESTNET_DEFAULT_PLATFORM_P2P_PORT,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { FIELD_COMPACT, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { refreshMasternodes } from '@renderer/hooks/useMasternodes'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import type { UpdateServiceModalProps } from '@renderer/types/MasternodeNodes'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import { buildServiceUpdate } from '@renderer/utils/masternodeActions'

export default function UpdateServiceModal({
  walletId,
  node,
  open,
  onClose,
}: UpdateServiceModalProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { receiving } = useAdresses(open ? walletId : undefined)
  const [serviceAddress, setServiceAddress] = useState(
    node.serviceAddress && node.serviceAddress !== UNASSIGNED_SERVICE_ADDRESS ? node.serviceAddress : '',
  )
  const [operatorPayoutAddress, setOperatorPayoutAddress] = useState('')
  const [platformNodeId, setPlatformNodeId] = useState(node.platformNodeId ?? '')
  const [platformP2PPort, setPlatformP2PPort] = useState(
    String(node.platformP2PPort ?? (network === 'testnet' ? TESTNET_DEFAULT_PLATFORM_P2P_PORT : MAINNET_PLATFORM_P2P_PORT)),
  )
  const [platformHttpPort, setPlatformHttpPort] = useState(
    String(node.platformHttpPort ?? (network === 'testnet' ? TESTNET_DEFAULT_PLATFORM_HTTP_PORT : MAINNET_PLATFORM_HTTP_PORT)),
  )

  const addressOptions = useMemo(
    () => receiving.map(addr => ({
      value: addr.address,
      label: addr.address,
      description: addr.label ?? addr.derivationPath,
      metadata: [`${davToDash(addr.balance)} ${DASH_UNIT}`],
    })),
    [receiving],
  )

  const { dto, error } = useMemo(
    () => buildServiceUpdate({
      type: node.type,
      serviceAddress,
      operatorPayoutAddress,
      platformNodeId,
      platformP2PPort,
      platformHttpPort,
      network,
    }),
    [node.type, serviceAddress, operatorPayoutAddress, platformNodeId, platformP2PPort, platformHttpPort, network],
  )

  const run = async (password: string): Promise<MasternodeUpdateResult> => {
    const result = await API.updateMasternodeService(walletId, node.proTxHash, dto!, password)
    void refreshMasternodes(walletId)
    void refreshBalance(walletId)
    return result
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <div className={'flex flex-col gap-1.5'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_SERVICE_COPY.serviceLabel}</Text>
        <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
          <input
            type={'text'}
            aria-label={UPDATE_SERVICE_COPY.serviceLabel}
            value={serviceAddress}
            onChange={e => setServiceAddress(e.target.value)}
            placeholder={UPDATE_SERVICE_COPY.servicePlaceholder}
            className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
          />
        </div>
      </div>

      <div className={'flex flex-col gap-1.5'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_SERVICE_COPY.operatorPayoutLabel}</Text>
        <DropdownField
          editable
          highlightValue
          options={addressOptions}
          value={operatorPayoutAddress}
          onChange={setOperatorPayoutAddress}
          placeholder={UPDATE_SERVICE_COPY.operatorPayoutPlaceholder}
          ariaLabel={UPDATE_SERVICE_COPY.operatorPayoutLabel}
          menuHeading={REGISTER_MASTERNODE_COPY.pickWalletAddress}
          triggerClassName={FIELD_COMPACT}
        />
      </div>

      {node.type === 'Evo' && (
        <div className={'flex flex-col gap-3'}>
          <div className={'flex flex-col gap-1.5'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformNodeIdLabel}</Text>
            <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
              <input
                type={'text'}
                aria-label={REGISTER_MASTERNODE_COPY.platformNodeIdLabel}
                value={platformNodeId}
                onChange={e => setPlatformNodeId(e.target.value)}
                placeholder={REGISTER_MASTERNODE_COPY.platformNodeIdPlaceholder}
                className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
              />
            </div>
          </div>
          <div className={'grid grid-cols-2 gap-3'}>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformP2PPortLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_MASTERNODE_COPY.platformP2PPortLabel}
                  value={platformP2PPort}
                  onChange={e => setPlatformP2PPort(e.target.value)}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
                />
              </div>
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformHttpPortLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_MASTERNODE_COPY.platformHttpPortLabel}
                  value={platformHttpPort}
                  onChange={e => setPlatformHttpPort(e.target.value)}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error != null && serviceAddress.trim() !== '' && (
        <Text size={12} weight={'medium'} color={'red'} className={'px-1'}>{error}</Text>
      )}
    </div>
  )

  return (
    <SignedActionModal<MasternodeUpdateResult>
      open={open}
      onClose={onClose}
      title={UPDATE_SERVICE_COPY.title}
      description={UPDATE_SERVICE_COPY.description}
      edit={{
        content: editContent,
        continueLabel: UPDATE_SERVICE_COPY.review,
        canContinue: dto != null,
      }}
      summary={
        dto && (
          <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.proTxHashLabel}</Text>
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{node.proTxHash}</HighlightedIdentifier>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_SERVICE_COPY.serviceLabel}</Text>
              <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>{dto.serviceAddress}</Text>
            </div>
            {dto.operatorPayoutAddress != null && (
              <div className={'flex items-center justify-between gap-4'}>
                <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_SERVICE_COPY.operatorPayoutLabel}</Text>
                <HighlightedIdentifier className={'min-w-0 text-xs!'}>{dto.operatorPayoutAddress}</HighlightedIdentifier>
              </div>
            )}
            {node.type === 'Evo' && (
              <>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformNodeIdLabel}</Text>
                  <HighlightedIdentifier className={'min-w-0 text-xs!'}>{dto.platformNodeId ?? ''}</HighlightedIdentifier>
                </div>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformP2PPortLabel}</Text>
                  <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`${dto.platformP2PPort} / ${dto.platformHttpPort}`}</Text>
                </div>
              </>
            )}
          </div>
        )
      }
      confirmLabel={UPDATE_SERVICE_COPY.confirm}
      confirmDisabled={dto == null}
      pendingLabel={UPDATE_SERVICE_COPY.pending}
      run={run}
      renderDone={result => ({
        headline: UPDATE_SERVICE_COPY.doneHeadline,
        details: [
          { label: REGISTER_MASTERNODE_COPY.networkFee, value: `${davToDash(result.fee)} ${DASH_UNIT}` },
          { label: REGISTER_MASTERNODE_COPY.peersAcked, value: String(result.peersAcked) },
        ],
        hash: {
          value: result.txid,
          label: UPDATE_SERVICE_COPY.txidLabel,
          explorerUrl: network == null ? null : transactionUrl(result.txid, network),
        },
      })}
    />
  )
}
