"use client";

import { useEffect, useState } from "react";
import { SuiteHeader } from "@geiger/ui/suite-header";

import { getUser } from "@/lib/supabase/user";
import { ProfileDropdown } from "@/components/internal/topbar/dialogue/profile_dropdown";

export function Header({ signInHref, homeHref, dashboardHref = "/org" }) {
  const [user, setUser] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;
    getUser()
      .then((u) => active && setUser(u))
      .finally(() => active && setResolved(true));
    return () => {
      active = false;
    };
  }, []);

  const profile = user ? (
    <ProfileDropdown />
  ) : resolved ? null : (
    <div className="h-8 w-8 rounded-full border border-border bg-surface-subtle" />
  );

  return (
    <SuiteHeader
      userId={user?.id}
      profile={profile}
      signInHref={signInHref}
      homeHref={homeHref}
      dashboardHref={dashboardHref}
    />
  );
}
