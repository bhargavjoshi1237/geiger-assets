"use client";

import { Building2, KeyRound, Mail } from "lucide-react";
import { TeamScreen } from "@/components/internal/screens/projects/collaboration/team_screen";

const channels = [
  { icon: Building2, title: "Organization directory", state: "Available", detail: "Sync existing organization members into this project." },
  { icon: Mail, title: "Email invitations", state: "Available", detail: "Invite members, guests, and reviewers with scoped roles." },
  { icon: KeyRound, title: "SSO and SCIM", state: "Not connected", detail: "An external identity provider is needed for single sign-on and automatic provisioning." },
];

function IdentityChannels() {
  return (
    <section aria-label="Provisioning methods" className="grid gap-3 lg:grid-cols-3">
      {channels.map(({ icon: Icon, title, state, detail }) => (
        <div key={title} className="rounded-xl border border-border bg-surface-subtle p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-medium text-text-secondary">{state}</span>
          </div>
          <h2 className="text-sm font-medium text-foreground">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{detail}</p>
        </div>
      ))}
    </section>
  );
}

export function IdentityProvisioningScreen({ projectId }) {
  return (
    <TeamScreen
      projectId={projectId}
      title="Identity & Provisioning"
      description="Manage who enters this workspace, how they receive access, and which invitations are still pending."
      intro={<IdentityChannels />}
    />
  );
}

export default IdentityProvisioningScreen;
