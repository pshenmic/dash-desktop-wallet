import { useEffect, useRef, useState } from 'react'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-extended/icons'
import { TooltipBubble } from '@renderer/components/dash-ui-kit-extended'
import { COPY_BUTTON_SIZES } from '@renderer/constants/clipboard'
import type { CopyButtonProps } from '@renderer/types/CopyButton'

export default function CopyButton({ text, className = '', disabled = false, label, size = 'compact' }: CopyButtonProps): React.JSX.Element {
  const [copiedRect, setCopiedRect] = useState<DOMRect | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dimensions = COPY_BUTTON_SIZES[size]

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>): void => {
    if (disabled) return
    navigator.clipboard.writeText(text)
    setCopiedRect(event.currentTarget.getBoundingClientRect())
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiedRect(null), 1200)
  }

  return (
    <>
      <button
        type={'button'}
        aria-label={label}
        title={label}
        onClick={handleCopy}
        disabled={disabled}
        className={`${dimensions.button} flex items-center justify-center hover:opacity-80 transition-opacity duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-30 ${className}`}
      >
        <CopyIcon2 size={dimensions.icon} color={'currentColor'} className={`dash-text-default ${dimensions.opacity}`} />
      </button>
      {copiedRect && <TooltipBubble rect={copiedRect} label={"Copied!"} animate />}
    </>
  )
}
