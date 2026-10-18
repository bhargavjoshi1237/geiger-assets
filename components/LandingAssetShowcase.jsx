import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PlaygroundFrame } from "@/components/landing/PlaygroundFrame";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Framed, interactive product preview for the landing page. Mirrors the suite's
// landing showcase (geiger-events EventsPlaygroundShowcase): a background-image
// section holding the intro copy + CTA, with the live Assets workspace running
// below in PlaygroundFrame: /playground in a lazily mounted iframe, so its
// dialogs, sheets and menus open inside the card rather than over the landing
// page.
export default function LandingAssetShowcase({
  backgroundImage,
  ctaHref,
  ctaLabel = "Open the workspace",
}) {
  return (
    <section
      className="relative mx-auto w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl border border-border bg-cover bg-center bg-no-repeat p-3 sm:w-[80%] sm:rounded-3xl sm:p-6 md:p-8 xl:p-10"
      style={backgroundImage ? { backgroundImage: `url('${backgroundImage}')` } : undefined}
    >
      <div className="absolute inset-0 bg-[#080808]/75" />
      <div className="relative z-10 flex flex-col gap-6 sm:gap-10">
        <div className="mx-auto mb-4 mt-4 flex w-full flex-col items-start gap-4 sm:mb-6 sm:mt-6 sm:w-[90%]">
          <h3 className="text-3xl font-semibold leading-tight text-white">
            Try the full Assets workspace in real time.
          </h3>

          <p className="max-w-lg text-[#bcbcbc]">
            This playground runs live on the page with the complete workspace —
            project sidebar, the assets overview, and every screen. No save and
            no load, just pure exploration.
          </p>

          <Link
            href={ctaHref}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-5 font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <PlaygroundFrame src={`${basePath}/playground`} title="Geiger Assets playground" />
      </div>
    </section>
  );
}
