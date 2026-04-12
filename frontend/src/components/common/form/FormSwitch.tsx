import { useController } from 'react-hook-form'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Switch } from '../Switch'

interface FormSwitchProps<T extends FieldValues> {
  name: Path<T>
  control: Control<T>
  label?: string
  disabled?: boolean
  className?: string
}

export function FormSwitch<T extends FieldValues>({
  name,
  control,
  label,
  disabled,
  className,
}: FormSwitchProps<T>) {
  const {
    field: { value, onChange, ...field },
    fieldState: { error }
  } = useController({ name, control })

  return (
    <Switch
      {...field}
      checked={!!value}
      onChange={onChange}
      label={label}
      disabled={disabled}
      className={className}
      error={error?.message}
    />
  )
}
