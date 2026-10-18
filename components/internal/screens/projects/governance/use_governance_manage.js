"use client";

import { useEffect, useState } from "react";
import { canManageGovernance } from "@/lib/supabase/governance";

export function useGovernanceManage(projectId) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let alive = true;
    canManageGovernance(projectId).then((value) => {
      if (alive) setAllowed(value);
    });
    return () => { alive = false; };
  }, [projectId]);

  return allowed;
}
