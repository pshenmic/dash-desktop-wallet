import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { MasternodeRegistrationResult } from '@renderer/api/types'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import DropdownField from '@renderer/components/ui/DropdownField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES } from '@renderer/constants/addressField'
import { DASH_UNIT } from '@renderer/constants/balance'
import { REGISTER_MASTERNODE_COPY, REGISTER_MASTERNODE_TYPE_OPTIONS } from '@renderer/constants/masternodeNodes'
import {
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  TESTNET_DEFAULT_PLATFORM_HTTP_PORT,
  TESTNET_DEFAULT_PLATFORM_P2P_PORT,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { FIELD_COMPACT, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { refreshMasternodes } from '@renderer/hooks/useMasternodes'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import { useWalletUtxos } from '@renderer/hooks/useWalletUtxos'
import type { RegisterMasternodeModalProps } from '@renderer/types/MasternodeNodes'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import { buildMasternodeRegistration, eligibleCollateralUtxos } from '@renderer/utils/masternodeActions'

export default function RegisterMasternodeModal({
  walletId,
  open,
  onClose,
}: RegisterMasternodeModalProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { utxos } = useWalletUtxos()
  const { receiving } = useAdresses(open ? walletId : undefined)
  const [type, setType] = useState<'Regular' | 'Evo'>('Regular')
  const [selectedCollateral, setSelectedCollateral] = useState('')
  const [payoutAddress, setPayoutAddress] = useState('')
  const [serviceAddress, setServiceAddress] = useState('')
  const [operatorRewardPercent, setOperatorRewardPercent] = useState('0')
  const [platformNodeId, setPlatformNodeId] = useState('')
  const [platformP2PPort, setPlatformP2PPort] = useState(
    String(network === 'testnet' ? TESTNET_DEFAULT_PLATFORM_P2P_PORT : MAINNET_PLATFORM_P2P_PORT),
  )
  const [platformHttpPort, setPlatformHttpPort] = useState(
    String(network === 'testnet' ? TESTNET_DEFAULT_PLATFORM_HTTP_PORT : MAINNET_PLATFORM_HTTP_PORT),
  )

  const collateralCoins = useMemo(() => eligibleCollateralUtxos(utxos, type), [utxos, type])
  const collateralOptions = useMemo(
    () => collateralCoins.map(coin => ({
      value: `${coin.txid}:${coin.vout}`,
      label: `${coin.txid.slice(0, 12)}…:${coin.vout}`,
      description: coin.address,
      metadata: [`${davToDash(coin.satoshis)} ${DASH_UNIT}`],
    })),
    [collateralCoins],
  )
  const activeCollateral = collateralOptions.some(opt => opt.value === selectedCollateral)
    ? selectedCollateral
    : (collateralOptions[0]?.value ?? '')

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
    () => buildMasternodeRegistration({
      type,
      collateralOutpoint: activeCollateral,
      payoutAddress,
      serviceAddress,
      operatorRewardPercent,
      platformNodeId,
      platformP2PPort,
      platformHttpPort,
      network,
    }),
    [type, activeCollateral, payoutAddress, serviceAddress, operatorRewardPercent, platformNodeId, platformP2PPort, platformHttpPort, network],
  )

  const run = async (password: string): Promise<MasternodeRegistrationResult> => {
    const result = await API.registerMasternode(walletId, dto!, password)
    void refreshMasternodes(walletId)
    void refreshBalance(walletId)
    return result
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <div className={'flex flex-col gap-1.5'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
        <SegmentedControl
          appearance={SegmentedControlAppearance.Pill}
          ariaLabel={REGISTER_MASTERNODE_COPY.typeLabel}
          options={REGISTER_MASTERNODE_TYPE_OPTIONS}
          value={type}
          onChange={setType}
        />
      </div>

      <div className={'flex flex-col gap-1.5'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.collateralLabel}</Text>
        {collateralOptions.length === 0 ? (
          <div className={SURFACE_SECTION}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.noCollateralUtxos}</Text>
          </div>
        ) : (
          <DropdownField
            options={collateralOptions}
            value={activeCollateral}
            onChange={setSelectedCollateral}
            ariaLabel={REGISTER_MASTERNODE_COPY.collateralLabel}
            triggerClassName={FIELD_COMPACT}
          />
        )}
      </div>

      <div className={'flex flex-col gap-1.5'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.payoutLabel}</Text>
        <DropdownField
          editable
          highlightValue
          options={addressOptions}
          value={payoutAddress}
          onChange={setPayoutAddress}
          placeholder={REGISTER_MASTERNODE_COPY.payoutPlaceholder}
          ariaLabel={REGISTER_MASTERNODE_COPY.payoutLabel}
          menuHeading={REGISTER_MASTERNODE_COPY.pickWalletAddress}
          triggerClassName={FIELD_COMPACT}
        />
      </div>

      <div className={'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        <div className={'flex flex-col gap-1.5'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.serviceLabel}</Text>
          <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
            <input
              type={'text'}
              aria-label={REGISTER_MASTERNODE_COPY.serviceLabel}
              value={serviceAddress}
              onChange={e => setServiceAddress(e.target.value)}
              placeholder={REGISTER_MASTERNODE_COPY.servicePlaceholder}
              className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
            />
          </div>
        </div>
        <div className={'flex flex-col gap-1.5'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.operatorRewardLabel}</Text>
          <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
            <input
              type={'text'}
              aria-label={REGISTER_MASTERNODE_COPY.operatorRewardLabel}
              value={operatorRewardPercent}
              onChange={e => setOperatorRewardPercent(e.target.value)}
              placeholder={REGISTER_MASTERNODE_COPY.operatorRewardPlaceholder}
              className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
            />
          </div>
        </div>
      </div>

      {type === 'Evo' && (
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

      {error != null && activeCollateral !== '' && payoutAddress.trim() !== '' && (
        <Text size={12} weight={'medium'} color={'red'} className={'px-1'}>{error}</Text>
      )}
    </div>
  )

  return (
    <SignedActionModal<MasternodeRegistrationResult>
      open={open}
      onClose={onClose}
      title={REGISTER_MASTERNODE_COPY.title}
      description={REGISTER_MASTERNODE_COPY.description}
      edit={{
        content: editContent,
        continueLabel: REGISTER_MASTERNODE_COPY.review,
        canContinue: dto != null,
      }}
      summary={
        dto && (
          <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
              <Text size={12} weight={'extrabold'} color={'brand'}>{dto.type}</Text>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.collateralLabel}</Text>
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{`${dto.collateral.txid}:${dto.collateral.vout}`}</HighlightedIdentifier>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.payoutLabel}</Text>
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{dto.payoutAddress}</HighlightedIdentifier>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.serviceLabel}</Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{dto.serviceAddress ?? UNASSIGNED_SERVICE_ADDRESS}</Text>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.operatorRewardLabel}</Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`${(dto.operatorReward / 100).toFixed(2)}%`}</Text>
            </div>
            {dto.type === 'Evo' && (
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
      confirmLabel={REGISTER_MASTERNODE_COPY.confirm}
      confirmDisabled={dto == null}
      pendingLabel={REGISTER_MASTERNODE_COPY.pending}
      run={run}
      renderDone={result => ({
        headline: REGISTER_MASTERNODE_COPY.doneHeadline,
        details: [
          { label: REGISTER_MASTERNODE_COPY.networkFee, value: `${davToDash(result.fee)} ${DASH_UNIT}` },
          { label: REGISTER_MASTERNODE_COPY.peersAcked, value: String(result.peersAcked) },
        ],
        hash: {
          value: result.proTxHash,
          label: REGISTER_MASTERNODE_COPY.proTxHashLabel,
          explorerUrl: network == null ? null : transactionUrl(result.proTxHash, network),
        },
      })}
    />
  )
}
