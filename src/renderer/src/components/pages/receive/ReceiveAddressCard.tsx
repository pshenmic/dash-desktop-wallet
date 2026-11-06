import React, { useState } from "react"
import { Text } from "@renderer/components/dash-ui-kit-extended"
import { RECEIVE_EMPTY_TEXTS } from "@renderer/constants/receiveCard"
import NoResults from "@renderer/components/ui/NoResults"
import ReceiveAddressPanel from "./ReceiveAddressPanel"
import { RECEIVE_INVOICE_ADDRESS_LABELS } from "@renderer/constants/receiveInvoice"
import { SEND_AMOUNT_PATTERN } from "@renderer/constants/sendRecipients"
import { FIELD_CONTROL_HEIGHT } from "@renderer/constants/surfaces"
import type { ReceiveAddressCardProps } from "@renderer/types/ReceiveInvoice"
import { defaultReceiveCoreAddress, receiveCoreAddresses } from "@renderer/utils/receiveDefaults"
import { corePaymentUri, receiveAmountParam } from "@renderer/utils/receiveInvoice"

export default function ReceiveAddressCard({
  addresses,
  defaultAddress,
  data,
}: ReceiveAddressCardProps): React.JSX.Element {
  const [amount, setAmount] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

  const receiveAddresses = receiveCoreAddresses(addresses)
  const selected = defaultReceiveCoreAddress(receiveAddresses, selectedAddress ?? defaultAddress)
  if (!selected) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noCoreAddresses} />
  }

  const amountParam = receiveAmountParam(amount)
  const paymentUri = corePaymentUri(selected.address, amountParam)

  return (
    <ReceiveAddressPanel
      addresses={receiveAddresses}
      selected={selected}
      onSelect={setSelectedAddress}
      addressLabel={RECEIVE_INVOICE_ADDRESS_LABELS.core}
      amount={amountParam}
      paymentLink={paymentUri}
    >
      <label htmlFor={"amount-input"} className={"flex flex-col gap-2"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          {data.amount}
        </Text>
        <input
          placeholder={data.placeholder}
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9.]/g, '')
            if (SEND_AMOUNT_PATTERN.test(val)) setAmount(val)
          }}
          id={"amount-input"}
          className={`${FIELD_CONTROL_HEIGHT} w-full rounded-[.875rem] dash-block px-4 py-3.5 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint`}
        />
      </label>
    </ReceiveAddressPanel>
  )
}
