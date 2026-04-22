import * as React from 'react'

import { useDataverseFieldMetadata } from '@/hooks/vendiq/use-dataverse-field-metadata'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type DataverseFieldLabelProps = React.ComponentProps<typeof Label> & {
  /**
   * Dataverse table logical name (e.g. `rpvms_vendors`). When provided together
   * with `fieldLogicalName`, the label reads live metadata and shows an asterisk
   * when the column is Business- or System-Required.
   */
  tableLogicalName?: string
  /** Dataverse column logical name (e.g. `rpvms_vendorname`). */
  fieldLogicalName?: string
  /** Display text to use when metadata is not available. */
  fallback?: string
  /**
   * Force the required indicator when metadata cannot drive it (e.g. for
   * client-only required fields that are not Dataverse-backed).
   */
  required?: boolean
}

/**
 * Standard form label for every editable field in the app.
 *
 * Renders the Dataverse display name (when metadata is available) and shows a
 * red asterisk when the column is `ApplicationRequired` or `SystemRequired`.
 * Use the `required` prop only for client-only fields that are not bound to a
 * Dataverse column.
 */
export function DataverseFieldLabel({
  tableLogicalName,
  fieldLogicalName,
  fallback,
  required,
  className,
  children,
  ...props
}: DataverseFieldLabelProps) {
  const { data } = useDataverseFieldMetadata(
    tableLogicalName ?? '',
    fieldLogicalName ?? '',
  )

  const text = data?.displayName ?? fallback ?? children
  const isRequired = data?.isRequired ?? required ?? false

  return (
    <Label className={cn(className)} {...props}>
      {text}
      {isRequired ? (
        <span aria-hidden="true" className="ml-0.5 text-signal-red">
          *
        </span>
      ) : null}
    </Label>
  )
}

/**
 * Hook form fields can use to read the resolved `isRequired` flag — useful for
 * setting `aria-required`/`aria-invalid` on the input and for blocking save.
 */
export function useDataverseFieldRequired(
  tableLogicalName: string | undefined,
  fieldLogicalName: string | undefined,
  fallback?: boolean,
): boolean {
  const { data } = useDataverseFieldMetadata(
    tableLogicalName ?? '',
    fieldLogicalName ?? '',
  )
  return data?.isRequired ?? fallback ?? false
}
