import type { Metadata } from "next";

export const APP_NAME = "Cresco Marketing Intelligence";

export const defaultMetadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "AI Marketing & Growth Platform for planning, creating, publishing, measuring, and optimising marketing campaigns.",
};
