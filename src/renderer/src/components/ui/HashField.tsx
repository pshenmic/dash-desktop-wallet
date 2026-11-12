import { useEffect, useRef, useState } from 'react'
import { Text, CheckIcon, ExternalLinkIcon, TooltipBubble } from '../dash-ui-kit-extended'
import { CopyIcon2 } from '../dash-ui-kit-extended/icons'
import { HASH_FIELD_VALUE_CLASS } from '@renderer/constants/hashField'
import { openExternal } from '@renderer/utils/explorer'

export default function HashField({ hash, label = 'State transition hash', explorerUrl, copyOnClick = true }: { hash: string; label?: string; explorerUrl?: string | null; copyOnClick?: boolean }): React.JSX.Element {
  const [copiedRect, setCopiedRect] = useState<DOMRect | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    navigator.clipboard.writeText(hash).catch(() => {})
    setCopiedRect(rect)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiedRect(null), 1200)
  }

  return (
    <div className={"flex flex-col gap-[.375rem]"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{label}</Text>
      <div className={"flex items-center gap-2"}>
        {copyOnClick ? (
          <button
            type={"button"}
            onClick={copy}
            className={`${HASH_FIELD_VALUE_CLASS} cursor-pointer hover:dash-block-accent-10 transition-colors duration-200`}
          >
            <Text size={12} weight={"medium"} color={"brand"} className={"block min-w-0 break-all font-mono text-[0.6875rem]! select-all leading-[140%]"}>
              {hash}
            </Text>
          </button>
        ) : (
          <div className={HASH_FIELD_VALUE_CLASS}>
            <Text size={12} weight={"medium"} color={"brand"} className={"block min-w-0 break-all font-mono text-[0.6875rem]! select-all leading-[140%]"}>
              {hash}
            </Text>
          </div>
        )}
        <button
          type={"button"}
          onClick={copy}
          aria-label={"Copy"}
          className={"size-9 shrink-0 rounded-[.75rem] flex items-center justify-center dash-block-5 dash-black-border cursor-pointer hover:opacity-80 transition-all duration-200"}
        >
          {copiedRect
            ? <CheckIcon size={16} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
            : <CopyIcon2 size={16} color={"currentColor"} className={"dash-text-default opacity-60"} />}
        </button>
        {explorerUrl && (
          <button
            type={"button"}
            onClick={() => openExternal(explorerUrl)}
            title={"View on explorer"}
            className={"size-9 shrink-0 rounded-[.75rem] flex items-center justify-center dash-block-5 dash-black-border cursor-pointer hover:opacity-80 transition-opacity duration-200"}
          >
            <ExternalLinkIcon size={16} color={"currentColor"} className={"dash-text-default opacity-60"} />
          </button>
        )}
      </div>
      {copiedRect && <TooltipBubble rect={copiedRect} label={"Copied!"} animate />}
    </div>
  )
}
