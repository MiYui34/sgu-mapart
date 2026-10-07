interface CheckProps {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}

interface RadioProps {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onChange: (value: string) => void
  children: React.ReactNode
}

export function Check({ checked, disabled, onChange, children }: CheckProps) {
  return (
    <label className={`choice${disabled ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="choice-mark check" />
      <span>{children}</span>
    </label>
  )
}

export function Radio({ name, value, checked, disabled, onChange, children }: RadioProps) {
  return (
    <label className={`choice${disabled ? ' is-disabled' : ''}`}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={() => onChange(value)} />
      <span className="choice-mark radio" />
      <span>{children}</span>
    </label>
  )
}
