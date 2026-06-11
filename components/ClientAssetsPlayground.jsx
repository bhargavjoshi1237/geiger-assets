"use client";

import dynamic from "next/dynamic";

const AssetsPlayground = dynamic(
  () => import("@/components/AssetsPlayground").then((mod) => mod.AssetsPlayground),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-strong border-t-[#e7e7e7]" />
      </div>
    ),
  }
);

export default AssetsPlayground;
