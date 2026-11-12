import { useState } from 'react'
import ExportKeyModal from '@renderer/components/modal/ExportKeyModal'
import AddressList from '@renderer/components/pages/addresses/AddressList'
import PageHeader from '@renderer/components/ui/PageHeader'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { useDebugMode } from '@renderer/hooks/useDebugMode'
import type { ExportKeyTarget } from '@renderer/types/ExportKey'

export default function AddressesPage(): React.JSX.Element {
  const { title, subtitle } = PAGE_HEADERS.addresses
  const { syncIncomplete } = useConnectionModeContext()
  const debugMode = useDebugMode()
  const [exportTarget, setExportTarget] = useState<ExportKeyTarget | null>(null)

  return (
    <div className={"flex flex-col"}>
      <div className={"px-12"}>
        <PageHeader title={title} subtitle={subtitle} />
      </div>
      <AddressList coreGated={syncIncomplete} onExportKey={debugMode ? setExportTarget : undefined} />
      <ExportKeyModal target={debugMode ? exportTarget : null} onClose={() => setExportTarget(null)} />
    </div>
  )
}
