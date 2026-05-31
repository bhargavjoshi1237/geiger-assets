import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  FolderKanban,
  Globe,
  HardDrive,
  LockKeyhole,
  Users,
  Workflow,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import LandingAssetShowcase from "@/components/LandingAssetShowcase";

export const metadata = {
  title: "Assets - Geiger Studio",
  description:
    "Organize, review, and distribute creative assets with Geiger Assets.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const dashOrigin = (process.env.NEXT_PUBLIC_DASH_ORIGIN || "").replace(/\/$/, "");
const assetsRoot = basePath || "/assets";
const loginHref = `${dashOrigin}/login?next=${encodeURIComponent(assetsRoot)}`;

const showcaseBackgroundImages = [
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-00a586c62c8782e65c0a.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/internal-brand-023-3291bb4c.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-0ec1f3ba625f482c9dc3.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-85923e7fafe00c9c0d1f.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-8e2e88cff7f33224ddd7.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-0a66efa21dd4b7e6c526.jpg",
  "https://200rfrtp5x71tlmk.public.blob.vercel-storage.com/geiger-dash/cursor-assets/asset-cc24ca462279ca23250c.jpg",
];

function getRandomShowcaseBackground() {
  const index = Math.floor(Math.random() * showcaseBackgroundImages.length);
  return showcaseBackgroundImages[index];
}

const utilityCards = [
  {
    title: "Centralized Asset Library",
    description:
      "Keep brand files, campaign media, documents, and deliverables organized in one searchable workspace.",
    icon: FolderKanban,
  },
  {
    title: "Fast Metadata Search",
    description:
      "Find the right file by type, owner, tag, status, collection, or review context without digging through folders.",
    icon: FileSearch,
  },
  {
    title: "Review Workflows",
    description:
      "Move assets from upload to approval with clear ownership, activity history, and lightweight collaboration.",
    icon: Workflow,
  },
  {
    title: "Brand Portals",
    description:
      "Share approved collections with teams, clients, and partners while keeping source libraries protected.",
    icon: Globe,
  },
  {
    title: "Storage Visibility",
    description:
      "Track file volume, storage usage, and collection growth before asset sprawl becomes operational noise.",
    icon: HardDrive,
  },
  {
    title: "Team Access",
    description:
      "Coordinate uploads, permissions, sharing, and usage from a project-focused asset command center.",
    icon: Users,
  },
];

const faqs = [
  {
    value: "item-1",
    question: "What can I store in Geiger Assets?",
    answer:
      "Images, videos, documents, audio, design exports, brand files, and other project media can be organized into collections.",
  },
  {
    value: "item-2",
    question: "Can I share assets outside my team?",
    answer:
      "Yes. Brand portals and shared collections are designed for controlled access to approved files.",
  },
  {
    value: "item-3",
    question: "Does it support review workflows?",
    answer:
      "Yes. Projects can track uploads, approvals, activity, and team actions from the asset workspace.",
  },
  {
    value: "item-4",
    question: "Is this connected to the wider Geiger Studio?",
    answer:
      "Yes. Geiger Assets is built as part of the Geiger Studio suite so creative files can support broader project workflows.",
  },
];

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={basePath || "/"} className="flex items-center gap-3">
             <Image
              src={`${basePath}/logo1.svg`}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5"
            />
          
          <span className="text-sm font-semibold text-white">Geiger Assets</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href={loginHref}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-white"
          >
            Log in
            
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function AssetsLandingPage() {
  const assetShowcaseBg = getRandomShowcaseBackground();

  return (
    <div className="flex min-h-screen w-full flex-col bg-zinc-950 text-zinc-100 selection:bg-blue-500/30 font-sans">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#80808030_1px,transparent_1px),linear-gradient(to_bottom,#80808030_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <Header />

      <main className="relative z-10 flex flex-1 flex-col pt-16 sm:pt-20">
        <section className="mx-auto mb-10 mt-10 flex w-full max-w-6xl items-start justify-start px-4 sm:mt-16 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="mb-4 text-2xl font-semibold text-white sm:text-3xl">
              Organize, approve, and deliver every project asset from one place.
            </h1>
            <p className="mb-6 max-w-xl text-sm text-zinc-400 sm:text-base">
              Geiger Assets gives teams a focused library for media, brand files,
              campaign deliverables, reviews, and shared portals without losing track
              of what is final.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={loginHref}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white sm:text-base"
              >
                Log in to Start
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <div className="my-10 sm:my-20">
          <section className="mx-auto w-[94%] max-w-6xl md:w-[80%]">
            <LandingAssetShowcase
              backgroundImage={assetShowcaseBg}
              ctaHref={loginHref}
              ctaLabel="Check out Assets"
            />
          </section>
        </div>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 sm:px-6 md:grid-cols-3">
          {utilityCards.map(({ title, description, icon: Icon }) => (
            <article
              key={title}
              className="rounded-sm border border-zinc-800 bg-[#191919] p-5"
            >
              <Icon className="mb-3 h-5 w-5 text-zinc-300" />
              <h2 className="font-medium text-zinc-100">{title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{description}</p>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 md:mt-16 md:flex-row">
          <div className="md:w-[35%]">
            <h2 className="text-3xl font-semibold text-white">Questions & Answers</h2>
          </div>
          <div className="md:w-[65%]">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq) => (
                <AccordionItem
                  key={faq.value}
                  value={faq.value}
                  className="border-zinc-800"
                >
                  <AccordionTrigger className="text-zinc-200 hover:text-white hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-400">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="relative z-20 overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="container mx-auto relative z-10 flex flex-col items-center text-center">
            <h3 className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase sm:text-sm">
              Built for Geiger Studio
            </h3>
            <h2 className="mb-8 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-3xl font-black tracking-tighter text-transparent drop-shadow-lg sm:mb-10 sm:text-5xl lg:text-6xl">
              TRY GEIGER ASSETS
            </h2>
            <div className="flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                href={loginHref}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-zinc-100 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-white sm:w-auto"
              >
                Studio
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/brand-assets"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-zinc-800 px-6 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white sm:w-auto"
              >
                Demo project
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500 sm:px-6">
        Geiger Assets / Geiger Studio
      </footer>
    </div>
  );
}
