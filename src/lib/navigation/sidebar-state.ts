const SIDEBAR_COLLAPSED_KEY = "cresco-sidebar-collapsed";
const SIDEBAR_SECTIONS_KEY = "cresco-sidebar-sections";

function getStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return globalThis.localStorage as Storage;
  }
  return null;
}

export function readSidebarCollapsed(): boolean {
  const storage = getStorage();
  if (!storage) {
    return false;
  }
  return storage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}

export function readCollapsedSections(): Record<string, boolean> {
  const storage = getStorage();
  if (!storage) {
    return {};
  }
  try {
    const raw = storage.getItem(SIDEBAR_SECTIONS_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function writeCollapsedSections(sections: Record<string, boolean>): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(sections));
}
