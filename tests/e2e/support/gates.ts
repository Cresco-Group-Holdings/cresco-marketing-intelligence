import type { Page, Response, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

const ALLOWED_CONSOLE_PATTERNS = [
  /Download the React DevTools/i,
  /favicon/i,
  /Failed to load resource: the server responded with a status of 404/i,
];

const RETRY_STORM_ENDPOINTS = [
  "/api/activation",
  "/api/dashboard/command-centre",
] as const;

const RETRY_STORM_THRESHOLD = 12;
const RETRY_STORM_WINDOW_MS = 15_000;

type RequestCounter = {
  startedAt: number;
  counts: Map<string, number>;
};

export type LaunchGateContext = {
  page: Page;
  unexpectedConsoleErrors: string[];
  unexpected5xx: Array<{ url: string; status: number }>;
  requestCounter: RequestCounter;
  stop: () => void;
};

function isAllowedConsoleMessage(message: string): boolean {
  return ALLOWED_CONSOLE_PATTERNS.some((pattern) => pattern.test(message));
}

function isSameOriginApi(response: Response, baseURL: string | undefined): boolean {
  const base = baseURL ?? "http://localhost:3000";
  try {
    const responseUrl = new URL(response.url());
    const origin = new URL(base);
    return responseUrl.origin === origin.origin && responseUrl.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function attachLaunchGates(page: Page, testInfo: TestInfo): LaunchGateContext {
  const unexpectedConsoleErrors: string[] = [];
  const unexpected5xx: Array<{ url: string; status: number }> = [];
  const requestCounter: RequestCounter = {
    startedAt: Date.now(),
    counts: new Map(),
  };

  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isAllowedConsoleMessage(text)) return;
    unexpectedConsoleErrors.push(text);
  };

  const onPageError = (error: Error) => {
    unexpectedConsoleErrors.push(error.message);
  };

  const onResponse = (response: Response) => {
    const pathname = new URL(response.url()).pathname;
    for (const endpoint of RETRY_STORM_ENDPOINTS) {
      if (pathname.startsWith(endpoint)) {
        const elapsed = Date.now() - requestCounter.startedAt;
        if (elapsed <= RETRY_STORM_WINDOW_MS) {
          requestCounter.counts.set(endpoint, (requestCounter.counts.get(endpoint) ?? 0) + 1);
        }
      }
    }

    if (!isSameOriginApi(response, testInfo.project.use.baseURL as string | undefined)) {
      return;
    }

    const status = response.status();
    if (status >= 500 && status <= 599) {
      unexpected5xx.push({ url: response.url(), status });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  return {
    page,
    unexpectedConsoleErrors,
    unexpected5xx,
    requestCounter,
    stop: () => {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("response", onResponse);
    },
  };
}

export function assertLaunchGates(
  gates: LaunchGateContext,
  options?: {
    allow5xx?: RegExp[];
    allowConsole?: RegExp[];
  },
) {
  const allowed5xx = options?.allow5xx ?? [];
  const allowedConsole = options?.allowConsole ?? [];

  const filtered5xx = gates.unexpected5xx.filter(
    (entry) => !allowed5xx.some((pattern) => pattern.test(entry.url)),
  );
  expect(filtered5xx, "Unexpected same-origin 5xx responses").toEqual([]);

  const filteredConsole = gates.unexpectedConsoleErrors.filter(
    (message) => !allowedConsole.some((pattern) => pattern.test(message)),
  );
  expect(filteredConsole, "Unexpected browser console errors").toEqual([]);

  for (const endpoint of RETRY_STORM_ENDPOINTS) {
    const count = gates.requestCounter.counts.get(endpoint) ?? 0;
    expect(
      count,
      `Retry storm detected for ${endpoint}: ${count} requests within ${RETRY_STORM_WINDOW_MS}ms`,
    ).toBeLessThanOrEqual(RETRY_STORM_THRESHOLD);
  }
}

export async function waitForReadiness(request: {
  get: (url: string) => Promise<{ ok: () => boolean; json: () => Promise<unknown> }>;
}) {
  const response = await request.get("/api/readiness");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { data?: { checks?: unknown } };
  expect(body.data?.checks).toBeDefined();
}
