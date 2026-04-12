import React from 'react'
import { useController } from 'react-hook-form'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { InputField } from '../InputField'

interface FormInputProps<T extends FieldValues> extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  name: Path<T>
  control: Control<T>
  label: string
  multi?: boolean
  rows?: number
}

export function FormInput<T extends FieldValues>({
  name,
  control,
  label,
  ...props
}: FormInputProps<T>) {
  const {
    field,
    fieldState: { error }
  } = useController({ name, control })

  return (
    <InputField
      {...props}
      {...field}
      label={label}
      error={error?.message}
      required={props.required}
    />
  )
}
