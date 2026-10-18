import { FanHub } from "@/components/internal/screens/projects/creator/public/fan_hub";
import { currentFan } from "@/lib/creator/fan_auth";
import { loadFanHub } from "@/lib/creator/fan_hub";
import { creatorDb } from "@/lib/creator/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your fan account", robots: { index: false, follow: false } };

/** The signed-in fan's memberships, payments and settings across every creator. */
export default async function FanRoute() {
  const db = await creatorDb();
  const fan = await currentFan(db);
  const hub = fan ? await loadFanHub(db, fan) : { creators: [], payments: [], feed: [], library: [], saved: [], stats: null, since: null };
  return <FanHub key={fan?.id || "signed-out"} fan={fan} hub={hub} />;
}
