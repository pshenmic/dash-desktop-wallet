import { Text } from '@renderer/components/dash-ui-kit-extended'
import { ENABLED_MASTERNODE_STATUS } from '@renderer/constants/masternodes'
import { SUMMARY_CELL_CLASS, SUMMARY_COPY, SUMMARY_FOOTER_CLASS, SUMMARY_LINK_CLASS, SUMMARY_SKELETON_CLASS, SUMMARY_STRIP_CLASS } from '@renderer/constants/masternodeNodes'
import { ContestSegment, NodeSegment } from '@renderer/enums/Masternodes'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import { useNameContests } from '@renderer/hooks/useNameContests'
import type { SummaryStripProps } from '@renderer/types/MasternodeScreens'
import { isEndingSoon } from '@renderer/utils/nameContests'

export default function SummaryStrip({ walletId, network, now, onSelectNodes, onSelectContests }: SummaryStripProps): React.JSX.Element {
  const { nodes, loading: nodesLoading, err: nodesError } = useMasternodes(walletId)
  const { contests, loading: contestsLoading, err: contestsError } = useNameContests(walletId)
  const active = nodes.filter(node => node.status === ENABLED_MASTERNODE_STATUS).length
  const withVotingKey = nodes.filter(node => node.votingKeyIndex != null).length
  const open = contests.filter(contest => contest.voteOutcome == null).length
  const endingSoon = contests.filter(contest => isEndingSoon(contest, now, network)).length

  return (
    <div className={SUMMARY_STRIP_CLASS} aria-busy={nodesLoading || contestsLoading}>
      {nodesLoading && nodes.length === 0 ? <div className={SUMMARY_SKELETON_CLASS} /> : (
        <div className={SUMMARY_CELL_CLASS}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{SUMMARY_COPY.nodes}</Text>
          <Text size={20} weight={'extrabold'} color={'brand'} className={'leading-[140%] tabular-nums'}>
            {nodesError != null && nodes.length === 0 ? SUMMARY_COPY.unavailable : nodes.length}
          </Text>
          {(nodesError == null || nodes.length > 0) && (
            <div className={SUMMARY_FOOTER_CLASS}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
                {`${active} ${SUMMARY_COPY.active}`}
                <span aria-hidden={true}>{SUMMARY_COPY.separator}</span>
              </Text>
              <button type={'button'} className={SUMMARY_LINK_CLASS} onClick={() => onSelectNodes(NodeSegment.VotingKey)}>
                <Text size={12} weight={'medium'} color={'blue-mint'}>{`${withVotingKey} ${SUMMARY_COPY.withVotingKey}`}</Text>
              </button>
            </div>
          )}
        </div>
      )}
      {contestsLoading && contests.length === 0 ? <div className={SUMMARY_SKELETON_CLASS} /> : (
        <div className={SUMMARY_CELL_CLASS}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{SUMMARY_COPY.openContests}</Text>
          <Text size={20} weight={'extrabold'} color={'brand'} className={'leading-[140%] tabular-nums'}>
            {contestsError != null && contests.length === 0 ? SUMMARY_COPY.unavailable : open}
          </Text>
          {(contestsError == null || contests.length > 0) && (
            <div className={SUMMARY_FOOTER_CLASS}>
              <button type={'button'} className={SUMMARY_LINK_CLASS} onClick={() => onSelectContests(ContestSegment.EndingSoon)}>
                <Text size={12} weight={'medium'} color={'blue-mint'}>{`${endingSoon} ${SUMMARY_COPY.endingSoon}`}</Text>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
