export interface PasswordFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  error?: string | null
  label?: string
  hideLabel?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}
