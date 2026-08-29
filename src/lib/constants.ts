import type { Metadata } from "next";

export const APP_NAME = "Cresco Marketing Intelligence";

export const defaultMetadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Connect your marketing stack. Understand what drives growth. Create and distribute better content. Know what to do next.",
};
