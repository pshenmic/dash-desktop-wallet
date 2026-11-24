import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Identities from "@renderer/components/pages/identities/Page";
import { useAuth } from '@renderer/contexts/AuthContext'
import type { IdentitiesSearchState } from '@renderer/types/Identities'

export function IdentitiesLayout(): React.JSX.Element {
  const { status } = useAuth()
  return <IdentitiesSearchOutlet key={status?.selectedWalletId ?? 'none'} />
}

function IdentitiesSearchOutlet(): React.JSX.Element {
  const [query, setQuery] = useState('')
  return <Outlet context={{ query, setQuery } satisfies IdentitiesSearchState} />
}

export default function IdentitiesPage(): React.JSX.Element {
  return (
    <Identities />
  )
}
