import { useMemo, useRef } from "react";
import { refreshIdentities, useIdentities } from "@renderer/hooks/useIdentities";
import { refreshMasternodeIdentities, useMasternodeIdentities } from "@renderer/hooks/useMasternodeIdentities";
import { useAuth } from "@renderer/contexts/AuthContext";
import IdentityRow from "./IdentityRow";
import CustomBadge from "@renderer/components/ui/CustomBadge";
import NoResults from "@renderer/components/ui/NoResults";
import RetryButton from "@renderer/components/ui/RetryButton";
import { NoResultsTone } from "@renderer/enums/NoResultsTone";
import ListSkeleton from "@renderer/components/ui/Skeleton";
import PageHeader from "@renderer/components/ui/PageHeader";
import PageTabs from "@renderer/components/ui/PageTabs";
import SearchField from "@renderer/components/ui/SearchField";
import { PAGE_HEADERS } from "@renderer/constants/pageHeaders";
import { CHIP_ACTION, SURFACE_PANEL } from "@renderer/constants/surfaces";
import {
  IDENTITIES_ROUTES,
  IDENTITIES_SEARCH_COPY,
  IDENTITIES_TABS,
  MASTERNODE_IDENTITIES_COPY,
} from "@renderer/constants/identities";
import { SEARCH_CLEAR_LABEL, TOOLBAR_SEARCH_CLASS } from "@renderer/constants/listToolbar";
import { Button } from "@renderer/components/dash-ui-kit-extended";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import type { IdentitiesSearchState } from "@renderer/types/Identities";
import { useDashPayUsernames } from "@renderer/hooks/useDashPayUsernames";
import { usePeriodicDashPayRefresh } from "@renderer/hooks/useDashPayRefresh";
import { identityHref, identityVotingNames } from "@renderer/utils/identities";
import { matchesIdentityQuery } from "@renderer/utils/dpnsLabel";
import { groupMasternodeIdentities, masternodeIdentityHref, matchesMasternodeIdentityQuery } from "@renderer/utils/masternodeIdentityView";
import { shortProTxHash } from "@renderer/utils/masternodeNodes";

export default function Identities(): React.JSX.Element {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const { identities, loading, err } = useIdentities(walletId)
  const { masternodeIdentities, loading: mnLoading, err: mnErr } = useMasternodeIdentities(walletId)
  const usernamesWalletId = identities.length > 0 || masternodeIdentities.length > 0 ? walletId : undefined
  const { usernames } = useDashPayUsernames(usernamesWalletId)
  usePeriodicDashPayRefresh(usernamesWalletId)
  const { query, setQuery } = useOutletContext<IdentitiesSearchState>()
  const searchRef = useRef<HTMLInputElement>(null)

  const requestedTab = searchParams.get(IDENTITIES_TABS.param)
  const activeTab = requestedTab === IDENTITIES_TABS.masternodeIdentities
    ? IDENTITIES_TABS.masternodeIdentities
    : IDENTITIES_TABS.yourIdentities

  const handleTabChange = (nextTab: string): void => {
    const nextParams = new URLSearchParams(searchParams)
    if (nextTab === IDENTITIES_TABS.masternodeIdentities) {
      nextParams.set(IDENTITIES_TABS.param, IDENTITIES_TABS.masternodeIdentities)
    } else {
      nextParams.delete(IDENTITIES_TABS.param)
    }
    setSearchParams(nextParams, { replace: true })
  }

  const rows = useMemo(() => identities.map(identity => ({
    identity,
    votingNames: identityVotingNames(identity, usernames),
  })), [identities, usernames])
  const visible = rows.filter(({ identity, votingNames }) =>
    matchesIdentityQuery(identity.identifier, [...identity.usernames, ...votingNames], query))

  const masternodeRows = useMemo(
    () => groupMasternodeIdentities(masternodeIdentities).map(view => ({
      view,
      votingNames: identityVotingNames(view.identity, usernames),
    })),
    [masternodeIdentities, usernames],
  )
  const visibleMasternodes = masternodeRows.filter(({ view, votingNames }) =>
    matchesMasternodeIdentityQuery(view, votingNames, query))

  const assetsList = [
    {
      value: IDENTITIES_TABS.yourIdentities,
      label: IDENTITIES_TABS.yourLabel,
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
                {visible.map(({ identity, votingNames }) => (
                  <IdentityRow key={identity.identifier} identity={identity} votingNames={votingNames} onOpen={identifier => navigate(identityHref(identifier))} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    },
    {
      value: IDENTITIES_TABS.masternodeIdentities,
      label: IDENTITIES_TABS.masternodeLabel,
      content: (
        <div className={"flex flex-col gap-5"}>
          {(masternodeRows.length > 0 || query !== '') && (
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={MASTERNODE_IDENTITIES_COPY.searchPlaceholder}
              ariaLabel={IDENTITIES_SEARCH_COPY.label}
              className={TOOLBAR_SEARCH_CLASS}
            />
          )}
          <div className={"flex flex-col gap-[.625rem] w-full"}>
            {mnLoading && <ListSkeleton rows={5} />}
            {!mnLoading && mnErr && (
              <NoResults
                tone={NoResultsTone.Error}
                noResults={MASTERNODE_IDENTITIES_COPY.loadFailed}
                action={walletId !== undefined && <RetryButton onRetry={() => refreshMasternodeIdentities(walletId)} />}
              />
            )}
            {!mnLoading && !mnErr && masternodeRows.length === 0 && (
              <NoResults
                title={MASTERNODE_IDENTITIES_COPY.emptyTitle}
                description={MASTERNODE_IDENTITIES_COPY.emptyDescription}
              />
            )}
            {!mnLoading && !mnErr && masternodeRows.length > 0 && visibleMasternodes.length === 0 && (
              <NoResults
                title={IDENTITIES_SEARCH_COPY.noMatch}
                action={
                  <button type={"button"} className={CHIP_ACTION} onClick={() => setQuery('')}>
                    {SEARCH_CLEAR_LABEL}
                  </button>
                }
              />
            )}
            {!mnLoading && !mnErr && visibleMasternodes.length > 0 && (
              <ul className={"contents"}>
                {visibleMasternodes.map(({ view, votingNames }) => (
                  <IdentityRow
                    key={view.identity.identifier}
                    identity={view.identity}
                    votingNames={votingNames}
                    readOnly
                    badges={view.bindings.map(binding => (
                      <CustomBadge
                        key={`${binding.proTxHash}:${binding.role}`}
                        variant={binding.role === 'owner' ? 'accent' : 'muted'}
                        size={'xs'}
                        text={`${MASTERNODE_IDENTITIES_COPY.roleLabels[binding.role]} · ${shortProTxHash(binding.proTxHash)}`}
                        className={'shrink-0'}
                      />
                    ))}
                    onOpen={identifier => navigate(masternodeIdentityHref(identifier))}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    },
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
            value={activeTab}
            onValueChange={handleTabChange}
          />
        </div>
      </div>
    </div>
  )
}
