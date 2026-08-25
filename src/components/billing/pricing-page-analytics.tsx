"use client";

import { useEffect } from "react";
import { trackCommercialEvent } from "@/lib/billing/commercial-analytics";

export function PricingPageAnalytics() {
  useEffect(() => {
    trackCommercialEvent("pricing_viewed");
  }, []);

  return null;
}
