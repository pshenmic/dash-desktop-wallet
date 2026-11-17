import React, { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipProps {
  label?: string
  side?: 'top' | 'bottom'
  align?: 'center' | 'end'
  children: React.ReactElement
}

interface ChildMouseProps {
  onMouseEnter?: React.MouseEventHandler
  onMouseLeave?: React.MouseEventHandler
}

export function TooltipBubble({
  rect,
  label,
  side = 'top',
  align = 'center',
  animate = false,
}: {
  rect: DOMRect
  label: string
  side?: 'top' | 'bottom'
  align?: TooltipProps['align']
  animate?: boolean
}): React.JSX.Element {
  const alignEnd = align === 'end'
  const horizontalOffset = alignEnd ? '-100%' : '-50%'
  const verticalOffset = side === 'top' ? 'calc(-100% - .375rem)' : '.375rem'
  return createPortal(
    <div
      role={"tooltip"}
      style={{
        position: 'fixed',
        left: alignEnd ? rect.right : rect.left + rect.width / 2,
        top: side === 'top' ? rect.top : rect.bottom,
        transform: `translate(${horizontalOffset}, ${verticalOffset})`,
      }}
      className={"z-[1000] pointer-events-none"}
    >
      <div
        className={`
          ${animate ? 'tooltip-pop ' : ''}
          relative whitespace-nowrap rounded-lg px-3.5 py-2
          text-[11px] font-medium leading-none
          bg-dash-brand text-white
          shadow-[0_4px_16px_0_rgba(76,126,255,0.32)]
        `}
      >
        {label}
        <span
          style={alignEnd ? { right: rect.width / 2 } : undefined}
          className={`
            absolute size-[.5rem] rotate-45
            ${alignEnd ? 'translate-x-1/2' : 'left-1/2 -translate-x-1/2'}
            bg-dash-brand
            ${side === 'top' ? 'bottom-0 translate-y-1/2' : 'top-0 -translate-y-1/2'}
          `}
        />
      </div>
    </div>,
    document.body
  )
}

export function Tooltip({ label, side = 'top', align = 'center', children }: TooltipProps): React.JSX.Element {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const childProps = children.props as ChildMouseProps

  const handleEnter = useCallback(
    (event: React.MouseEvent) => {
      childProps.onMouseEnter?.(event)
      if (label) setRect(event.currentTarget.getBoundingClientRect())
    },
    [childProps, label]
  )

  const handleLeave = useCallback(
    (event: React.MouseEvent) => {
      childProps.onMouseLeave?.(event)
      setRect(null)
    },
    [childProps]
  )

  const child = React.cloneElement(children, {
    onMouseEnter: handleEnter,
    onMouseLeave: handleLeave,
  } as ChildMouseProps)

  return (
    <>
      {child}
      {label && rect && <TooltipBubble rect={rect} label={label} side={side} align={align} />}
    </>
  )
}
