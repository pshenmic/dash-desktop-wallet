import { Text } from '@renderer/components/dash-ui-kit-extended'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import PlatformUnlockTab from '@renderer/components/pages/addresses/PlatformUnlockTab'
import ReceiveAddressPanel from './ReceiveAddressPanel'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { defaultReceivePlatformAddress, receivePlatformAddresses } from '@renderer/utils/receiveDefaults'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { receiveCardCopy } from '@renderer/constants'
import { RECEIVE_EMPTY_TEXTS } from '@renderer/constants/receiveCard'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'

export default function PlatformReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const { platformAddresses, loading, err } = usePlatformAddresses(walletId)

  if (loading) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (err) {
    return (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={RECEIVE_EMPTY_TEXTS.platformLoadFailed}
        action={walletId !== undefined && <RetryButton onRetry={() => refreshPlatformAddresses(walletId)} />}
      />
    )
  }

  if (platformAddresses.length === 0) {
    return <PlatformUnlockTab walletId={walletId} />
  }

  const receiveAddresses = receivePlatformAddresses(platformAddresses)
  const selected = defaultReceivePlatformAddress(receiveAddresses)
  if (!selected) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noPlatformAddresses} />
  }

  return (
    <ReceiveAddressPanel
      address={selected.platformAddress}
      wideAddress
      addressLabel={RECEIVE_INVOICE_ADDRESS_LABELS.platform}
    >
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        {receiveCardCopy.platformNote}
      </Text>
    </ReceiveAddressPanel>
  )
}
