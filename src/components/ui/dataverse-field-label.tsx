import * as React from 'react'

import { useDataverseFieldMetadata } from '@/hooks/vendiq/use-dataverse-field-metadata'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function DataverseFieldLabel({
  tableLogicalName,
  fieldLogicalName,
  fallback,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Label> & {
  tableLogicalName: string
  fieldLogicalName: string
  fallback?: string
}) {
  const { data } = useDataverseFieldMetadata(tableLogicalName, fieldLogicalName)

  const text = data?.displayName ?? fallback ?? children
  const isRequired = data?.isRequired ?? false

  return (
    <Label className={cn(className)} {...props}>
      {text}
      {isRequired ? (
        <span aria-hidden="true" className="text-signal-red">
          *
        </span>
      ) : null}
    </Label>
  )
}

export { DataverseFieldLabel }