"use client";

import { PermissionsSecurityScreen } from "@/components/internal/screens/projects/settings/permissions_security_screen";

export function PermissionsScreen({ projectId }) {
  return (
    <PermissionsSecurityScreen
      projectId={projectId}
      title="Permissions"
      description="Define workspace roles and review the access rules that apply to this project."
    />
  );
}

export default PermissionsScreen;
