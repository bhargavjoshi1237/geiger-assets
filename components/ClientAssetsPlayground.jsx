"use client";

import dynamic from "next/dynamic";
import { LogoLoading } from "@geiger/ui";

const AssetsPlayground = dynamic(
  () => import("@/components/AssetsPlayground").then((mod) => mod.AssetsPlayground),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <LogoLoading size={80} />
      </div>
    ),
  }
);

export default AssetsPlayground;
