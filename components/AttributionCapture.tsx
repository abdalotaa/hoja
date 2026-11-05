"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/** Stores the campaign in the link (utm_*) when someone lands on any page. Renders nothing. */
export default function AttributionCapture() {
  useEffect(() => captureAttribution(), []);
  return null;
}
