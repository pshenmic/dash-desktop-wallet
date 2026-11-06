import { Text } from '@renderer/components/dash-ui-kit-extended'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-extended/icons'
import HashField from '@renderer/components/ui/HashField'
import { RECEIVE_INVOICE_COPY, RECEIVE_QR_SIZE } from '@renderer/constants/receiveInvoice'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { ReceiveAddressPanelProps } from '@renderer/types/ReceiveInvoice'
import { copyWithToast } from '@renderer/utils/clipboard'
import ReceiveAddressSelect from './ReceiveAddressSelect'
import ReceiveQr from './ReceiveQr'

export default function ReceiveAddressPanel({
  addresses,
  selected,
  onSelect,
  addressLabel,
  addressBadge,
  amount = null,
  paymentLink,
  children,
}: ReceiveAddressPanelProps): React.JSX.Element {
  const { status } = useAuth()

  return (
    <div className={`flex w-full min-w-0 max-w-190 items-start gap-8 ${SURFACE_SECTION}`}>
      <div className={'flex shrink-0 flex-col gap-3'} style={{width: RECEIVE_QR_SIZE}}>
        <ReceiveQr
          value={paymentLink ?? selected.address}
          invoice={{
            addressLabel,
            address: selected.address,
            amount,
            paymentLink: amount == null ? null : paymentLink ?? null,
            network: status?.network ?? null,
          }}
        />
        {paymentLink != null && (
          <div className={'flex flex-col gap-2'}>
            <HashField hash={paymentLink} label={RECEIVE_INVOICE_COPY.paymentLink} readOnly />
            <button
              type={'button'}
              className={`${CHIP_ACTION} inline-flex h-9 w-full items-center justify-center gap-1.5 font-medium`}
              onClick={() => copyWithToast(paymentLink)}
            >
              <CopyIcon2 size={12} color={'currentColor'} />
              {RECEIVE_INVOICE_COPY.copyPaymentLink}
            </button>
          </div>
        )}
      </div>
      <div className={'flex min-w-0 flex-1 flex-col gap-3'}>
        <div className={'flex min-w-0 flex-col gap-2'}>
          <div className={'flex items-center gap-2'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{addressLabel}</Text>
            {addressBadge}
          </div>
          <ReceiveAddressSelect addresses={addresses} selected={selected} onSelect={onSelect} />
        </div>
        {children}
      </div>
    </div>
  )
}
