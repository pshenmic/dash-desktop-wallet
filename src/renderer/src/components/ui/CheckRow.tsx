import Checkbox from '@renderer/components/ui/Checkbox'
import type { CheckRowProps } from '@renderer/types/CheckRow'

export default function CheckRow({label, checked, onChange, children, below, title, disabled = false, dimChildren = true}: CheckRowProps): React.JSX.Element {
  let surface = 'dash-block hover:dash-block-accent-5'
  if (checked) surface = 'dash-block-accent-5'
  else if (disabled) surface = 'dash-block opacity-40'
  return (
    <div title={title} className={'relative min-w-0 rounded-[.875rem]'}>
      <div className={`pointer-events-none absolute inset-0 rounded-[.875rem] transition-colors ${surface}`} />
      <div className={'relative flex min-h-12 items-center px-[.9375rem] py-[.625rem]'}>
        <Checkbox appearance="subtle" className={`absolute inset-0 px-[.9375rem] ${disabled ? 'cursor-not-allowed! opacity-40' : ''}`} checked={checked} disabled={disabled} onChange={onChange} label={<span className={'sr-only'}>{label}</span>} />
        <div className={`relative pointer-events-none min-w-0 flex-1 ml-8 ${disabled && dimChildren ? 'opacity-40' : ''}`}>{children}</div>
      </div>
      {below && <div className={'relative px-[.9375rem] pt-1.5 pb-3.5'}>{below}</div>}
    </div>
  )
}
