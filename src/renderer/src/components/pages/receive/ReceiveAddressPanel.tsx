import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-extended/icons'
import CopyButton from '@renderer/components/ui/CopyButton'
import HashField from '@renderer/components/ui/HashField'
import { ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS } from '@renderer/constants/addressSelect'
import { RECEIVE_INVOICE_COPY, RECEIVE_QR_SIZE, RECEIVE_WIDE_PANEL_CLASS } from '@renderer/constants/receiveInvoice'
import { CHIP_ACTION, FIELD_CONTROL_HEIGHT, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { ReceiveAddressPanelProps } from '@renderer/types/ReceiveInvoice'
import { copyWithToast } from '@renderer/utils/clipboard'
import ReceiveQr from './ReceiveQr'

export default function ReceiveAddressPanel({
  address,
  wideAddress = false,
  title,
  addressLabel,
  addressBadge,
  label = null,
  amount = null,
  paymentLink,
  disabled = false,
  onCopyAddress,
  onCopyPaymentLink,
  children,
}: ReceiveAddressPanelProps): React.JSX.Element {
  const { status } = useAuth()

  return (
    <div className={`flex flex-wrap w-full min-w-0 items-start gap-8 ${wideAddress ? RECEIVE_WIDE_PANEL_CLASS : 'max-w-190'} ${SURFACE_SECTION}`}>
      <div className={'flex shrink-0 flex-col gap-3'} style={{width: RECEIVE_QR_SIZE}}>
        <ReceiveQr
          value={paymentLink ?? address}
          invoice={{
            addressLabel,
            address,
            label,
            amount,
            network: status?.network ?? null,
          }}
        />
        {paymentLink != null && (
          <div className={'flex flex-col gap-2'}>
            <HashField hash={paymentLink} label={null} readOnly />
            <button
              type={'button'}
              disabled={disabled}
              className={`${CHIP_ACTION} inline-flex h-9 w-full items-center justify-center gap-1.5 font-medium disabled:pointer-events-none disabled:opacity-50`}
              onClick={() => {
                copyWithToast(paymentLink)
                onCopyPaymentLink?.()
              }}
            >
              <CopyIcon2 size={12} color={'currentColor'} />
              {RECEIVE_INVOICE_COPY.copyPaymentLink}
            </button>
          </div>
        )}
      </div>
      <div className={'flex min-w-60 flex-1 flex-col gap-3'}>
        {title && (
          <Text size={14} weight={'extrabold'} color={'brand'}>
            {title}
          </Text>
        )}
        <div className={'flex min-w-0 flex-col gap-2'}>
          <div className={'flex items-center gap-2'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{addressLabel}</Text>
            {addressBadge}
          </div>
          <div className={'flex min-w-0 items-center rounded-[.875rem] dash-block'}>
            {wideAddress ? (
              <div className={'flex min-h-12 min-w-0 flex-1 items-center rounded-l-[.875rem] px-4 py-2.5 cursor-text select-text'}>
                <HighlightedIdentifier className={ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS}>{address}</HighlightedIdentifier>
              </div>
            ) : (
              <input
                type={'text'}
                readOnly
                value={address}
                aria-label={addressLabel}
                className={`${FIELD_CONTROL_HEIGHT} min-w-0 flex-1 rounded-l-[.875rem] bg-transparent px-4 text-sm font-medium dash-text-default outline-none focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint`}
              />
            )}
            <CopyButton
              text={address}
              label={RECEIVE_INVOICE_COPY.copyAddress}
              size={'field'}
              disabled={disabled}
              onCopy={onCopyAddress}
            />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
