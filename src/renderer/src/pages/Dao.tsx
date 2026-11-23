import Dao from '@renderer/components/pages/dao/Page'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function DaoPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  if (walletId == null) return null
  return <Dao key={walletId} walletId={walletId} />
}
