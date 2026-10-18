import { redirect } from "next/navigation";

// The fan inbox is a drawer on the creator page now; old links land there open.
export default async function CreatorMessagesRoute({ params }) {
  const { handle } = await params;
  redirect(`/c/${encodeURIComponent(handle)}?messages=1`);
}
