import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import type { TransferRouteCardsProps } from '@renderer/types/TransferRouteCards'

export default function TransferRouteCards({from, to}: TransferRouteCardsProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className={SURFACE_PANEL}>{from}</div>
      <div className={SURFACE_PANEL}>{to}</div>
    </div>
  )
}
