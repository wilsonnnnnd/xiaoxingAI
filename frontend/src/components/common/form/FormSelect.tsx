import React from 'react'
import { useController } from 'react-hook-form'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Select } from '../Select'

interface Option {
  label: string
  value: string | number
}

interface FormSelectProps<T extends FieldValues> extends React.SelectHTMLAttributes<HTMLSelectElement> {
  name: Path<T>
  control: Control<T>
  label?: string
  options: Option[]
}

export function FormSelect<T extends FieldValues>({
  name,
  control,
  label,
  options,
  ...props
}: FormSelectProps<T>) {
  const {
    field,
    fieldState: { error }
  } = useController({ name, control })

  return (
    <Select
      {...props}
      {...field}
      label={label}
      options={options}
      error={error?.message}
      required={props.required}
    />
  )
}
