import ClientAssetsPlayground from "@/components/ClientAssetsPlayground";

export default async function AssetsProjectPage({ params }) {
  const { projectId } = await params;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <ClientAssetsPlayground projectId={projectId} />
    </div>
  );
}
