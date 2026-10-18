import ClientAssetsPlayground from "@/components/ClientAssetsPlayground";

// The landing-page playground, served on its own route so the showcase can
// embed it in an iframe. The frame is what keeps the workspace's dialogs,
// sheets, menus and toasts — all portalled to <body> with fixed positioning —
// inside the showcase card instead of covering the landing page.
export const metadata = {
  title: "Assets Playground - Geiger Studio",
  robots: { index: false, follow: false },
};

export default function AssetsPlaygroundPage() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <ClientAssetsPlayground />
    </div>
  );
}
