import { useRef, useState } from 'react'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import DropdownChevron from '@renderer/components/ui/DropdownChevron'
import { ADDRESS_SELECT_IDENTIFIER_CLASS, ADDRESS_SELECT_MENU, ADDRESS_SELECT_OPTION, ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS, RECEIVE_ADDRESS_SELECT_TRIGGER } from '@renderer/constants/addressSelect'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RECEIVE_INVOICE_COPY } from '@renderer/constants/receiveInvoice'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { useFiat } from '@renderer/hooks/useFiat'
import type { ReceiveAddressSelectProps } from '@renderer/types/ReceiveInvoice'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { davToDashCompact } from '@renderer/utils/balance'

export default function ReceiveAddressSelect({ addresses, selected, onSelect, wideAddress = false }: ReceiveAddressSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { format, rateReady } = useFiat()
  const identifierClass = wideAddress ? ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS : `${ADDRESS_SELECT_IDENTIFIER_CLASS} min-w-0 [&>div]:truncate`

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className={'relative min-w-0'} ref={ref}>
      <div className={'flex min-w-0 items-center rounded-[.875rem] dash-block'}>
        <button
          type={'button'}
          aria-expanded={open}
          title={selected.address}
          onClick={() => setOpen(value => !value)}
          className={RECEIVE_ADDRESS_SELECT_TRIGGER}
        >
          <HighlightedIdentifier className={identifierClass}>{selected.address}</HighlightedIdentifier>
          <DropdownChevron open={open} />
        </button>
        <CopyButton text={selected.address} label={RECEIVE_INVOICE_COPY.copyAddress} size={'field'} />
      </div>

      {open && (
        <div className={`${ADDRESS_SELECT_MENU} max-w-full`}>
          {addresses.map(({ address, balance }) => (
            <button
              key={address}
              type={'button'}
              onClick={() => { onSelect(address); setOpen(false) }}
              className={`${ADDRESS_SELECT_OPTION} ${address === selected.address ? 'dash-block-accent-5' : ''}`}
            >
              <div className={'flex min-w-0 flex-col items-start gap-0.5'}>
                <HighlightedIdentifier className={ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS}>{address}</HighlightedIdentifier>
                <span className={'inline-flex items-baseline gap-1.5 whitespace-nowrap'}>
                  <Text reset size={12} weight={'medium'} color={'brand'} opacity={50}>{davToDashCompact(balance)} {DASH_UNIT}</Text>
                  {rateReady && <Text reset size={10} weight={'medium'} color={'blue-mint'}>{formatApproxFiat(format(balance))}</Text>}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
