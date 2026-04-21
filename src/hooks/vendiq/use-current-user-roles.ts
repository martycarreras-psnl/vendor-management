// Role/permission gate for the Adjust Criticality flow.
//
// The plan called for a hard gate on the `Vendor Steward` security role resolved via
// Dataverse WhoAmI + RetrieveUserRoles. Those calls require registering additional
// system tables (systemuser, roleassignment) as data sources, which has not been done
// in this cycle. Until then we gate via the env flag `VITE_ENABLE_CRITICALITY_EDIT`:
//
//   VITE_ENABLE_CRITICALITY_EDIT=true   → Adjust Criticality control visible
//   (anything else, including unset)    → control hidden
//
// When the systemuser tables are onboarded, replace this hook with a real WhoAmI +
// role-name check and keep the same return shape.

export function useCurrentUserRoles(): {
  canAdjustCriticality: boolean;
  isResolved: boolean;
  roles: string[];
} {
  const flag = import.meta.env.VITE_ENABLE_CRITICALITY_EDIT;
  const enabled = flag === true || flag === 'true' || flag === '1';
  return {
    canAdjustCriticality: enabled,
    isResolved: true,
    roles: enabled ? ['Vendor Steward (flag)'] : [],
  };
}
