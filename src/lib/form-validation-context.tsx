import * as React from 'react';

/**
 * Context that lets every editable field helper discover whether its own key
 * is currently flagged invalid (e.g. a required field left empty on save).
 * Avoids prop-threading `invalid` through every form call site.
 *
 * Wrap the editable region of a form with `<FormValidationProvider>`. Field
 * helpers call `useFieldInvalid(fieldKey)` and set
 * `aria-invalid={invalid || undefined}` on their input.
 */
interface FormValidationContextValue {
  invalidFields: ReadonlySet<string>;
}

const FormValidationContext = React.createContext<FormValidationContextValue>({
  invalidFields: new Set<string>(),
});

export function FormValidationProvider({
  invalidFields,
  children,
}: {
  invalidFields: ReadonlySet<string>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ invalidFields }), [invalidFields]);
  return (
    <FormValidationContext.Provider value={value}>{children}</FormValidationContext.Provider>
  );
}

export function useFieldInvalid(fieldKey: string | number | symbol | undefined): boolean {
  const { invalidFields } = React.useContext(FormValidationContext);
  return !!fieldKey && typeof fieldKey === 'string' && invalidFields.has(fieldKey);
}
