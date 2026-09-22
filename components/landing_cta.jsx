"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getUser } from "@/lib/supabase/user";

export function LandingCta({
  signedOutHref,
  signedOutLabel,
  signedInHref = "/project",
  signedInLabel,
  className,
  children,
}) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    getUser().then((u) => active && setUser(u));
    return () => {
      active = false;
    };
  }, []);

  const href = user ? signedInHref : signedOutHref;
  const label = user ? (signedInLabel ?? signedOutLabel) : signedOutLabel;

  return (
    <Link href={href} className={className}>
      {label}
      {children}
    </Link>
  );
}
