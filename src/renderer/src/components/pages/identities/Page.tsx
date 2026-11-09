import { useRef } from "react";
import { refreshIdentities, useIdentities } from "@renderer/hooks/useIdentities";
import { useAuth } from "@renderer/contexts/AuthContext";
import IdentityRow from "./IdentityRow";
import NoResults from "@renderer/components/ui/NoResults";
import RetryButton from "@renderer/components/ui/RetryButton";
import { NoResultsTone } from "@renderer/enums/NoResultsTone";
import ListSkeleton from "@renderer/components/ui/Skeleton";
import PageHeader from "@renderer/components/ui/PageHeader";
import PageTabs from "@renderer/components/ui/PageTabs";
import SearchField from "@renderer/components/ui/SearchField";
import { PAGE_HEADERS } from "@renderer/constants/pageHeaders";
import { CHIP_ACTION, SURFACE_PANEL } from "@renderer/constants/surfaces";
import { IDENTITIES_ROUTES, IDENTITIES_SEARCH_COPY } from "@renderer/constants/identities";
import { SEARCH_CLEAR_LABEL, TOOLBAR_SEARCH_CLASS } from "@renderer/constants/listToolbar";
import { Button } from "@renderer/components/dash-ui-kit-extended";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { IdentitiesSearchState } from "@renderer/types/Identities";
import { identityHref } from "@renderer/utils/identities";
import { filterIdentities } from "@renderer/utils/dashPayIdentity";

export default function Identities(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { identities, loading, err } = useIdentities(walletId)
  const { query, setQuery } = useOutletContext<IdentitiesSearchState>()
  const searchRef = useRef<HTMLInputElement>(null)
  const visible = filterIdentities(identities, query)

  const assetsList = [
    {
      value: 'your-identities',
      label: 'Your Identities',
      content: (
        <div className={"flex flex-col gap-5"}>
          {(identities.length > 0 || query !== '') && (
            <SearchField
              ref={searchRef}
              value={query}
              onChange={setQuery}
              placeholder={IDENTITIES_SEARCH_COPY.placeholder}
              ariaLabel={IDENTITIES_SEARCH_COPY.label}
              className={TOOLBAR_SEARCH_CLASS}
            />
          )}
          <div className={"flex flex-col gap-[.625rem] w-full"}>
            {loading && <ListSkeleton rows={5} />}
            {!loading && err && (
              <NoResults
                tone={NoResultsTone.Error}
                noResults={"Failed to load identities"}
                action={walletId !== undefined && <RetryButton onRetry={() => refreshIdentities(walletId)} />}
              />
            )}
            {!loading && !err && identities.length === 0 && (
              <NoResults
                title={"No identities yet"}
                action={<Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={() => navigate(IDENTITIES_ROUTES.register)}>Register identity</Button>}
              />
            )}
            {!loading && !err && identities.length > 0 && visible.length === 0 && (
              <NoResults
                title={IDENTITIES_SEARCH_COPY.noMatch}
                action={
                  <button type={"button"} className={CHIP_ACTION} onClick={() => {
                    searchRef.current?.focus()
                    setQuery('')
                  }}>
                    {SEARCH_CLEAR_LABEL}
                  </button>
                }
              />
            )}
            {!loading && !err && visible.length > 0 && (
              <ul className={"contents"}>
                {visible.map((identity) => (
                  <IdentityRow key={identity.identifier} identity={identity} onOpen={identifier => navigate(identityHref(identifier))} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    }
  ]

  return (
    <div className={"relative flex flex-col pb-12"}>
      <div className={"px-12"}>
        <PageHeader
          title={PAGE_HEADERS.identities.title}
          subtitle={PAGE_HEADERS.identities.subtitle}
          actions={<Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={() => navigate(IDENTITIES_ROUTES.register)}>Register identity</Button>}
        />
        <div className={`relative ${SURFACE_PANEL}`}>
          <PageTabs
            items={assetsList}
            value={'your-identities'}
          />
        </div>
      </div>
    </div>
  )
}
