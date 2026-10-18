import { FanReset } from "@/components/internal/screens/projects/creator/public/fan_hub";

export const metadata = { title: "Reset password", robots: { index: false, follow: false } };

export default async function FanResetRoute({ searchParams }) {
  const { token } = await searchParams;
  return <FanReset token={token || ""} />;
}
