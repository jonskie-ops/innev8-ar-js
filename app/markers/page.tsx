import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkerSheet } from "@/components/MarkerSheet";
import { TEST_MODE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Test QR codes · INNEV8 AR",
  robots: { index: false, follow: false },
};

/** Printable hunt QR codes for testing. Test mode only: in production this page doesn't exist. */
export default function MarkersPage() {
  if (!TEST_MODE) notFound();
  return <MarkerSheet />;
}
