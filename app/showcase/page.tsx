import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Showcase } from "@/components/showcase/Showcase";
import { TEST_MODE } from "@/lib/site";

export const metadata: Metadata = {
  title: "AR test · INNEV8 QR Code Hunt",
  robots: { index: false, follow: false },
};

/** AR test: virtual 3D QR codes hidden around you. Test mode only. */
export default function ShowcasePage() {
  if (!TEST_MODE) notFound();
  return <Showcase />;
}
