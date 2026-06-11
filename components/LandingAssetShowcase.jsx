import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ClientAssetsPlayground from "@/components/ClientAssetsPlayground";

export default function LandingAssetShowcase({ backgroundImage, ctaHref, ctaLabel }) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-[#191919] bg-cover bg-center p-3 sm:rounded-3xl sm:p-6 md:p-8 xl:p-10"
      style={backgroundImage ? { backgroundImage: `url('${backgroundImage}')` } : undefined}
    >
      <div className="pointer-events-none absolute inset-0 bg-background/35" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_55%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[70%] -translate-x-1/2 bg-white/[0.04] blur-[90px]" />
      <div className="flex flex-col gap-6 sm:gap-10">
        <div className="space-y-5">
          <div className="relative z-10 mx-auto mb-4 mt-4 flex w-[92%] flex-col items-start gap-4 sm:mb-6 sm:mt-6 sm:w-[90%]">
            <h3 className="text-3xl font-semibold leading-tight text-white">
              Explore the full Geiger Assets project workspace.
            </h3>

            <p className="max-w-sm text-foreground0">
              This playground runs the Assets project interface locally on the
              homepage with the project sidebar, topbar, overview dashboard, and
              asset management controls.
            </p>

            <Link
              href={ctaHref}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-100 px-5 font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              {ctaLabel || "Check out Assets"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-border-strong/80 bg-[#191919]/70 p-2 shadow-2xl backdrop-blur-md sm:p-3">
          <div className="h-[520px] overflow-hidden rounded-xl border border-border bg-background sm:h-[620px] lg:h-[760px]">
            <ClientAssetsPlayground />
          </div>
        </div>
      </div>
    </section>
  );
}
