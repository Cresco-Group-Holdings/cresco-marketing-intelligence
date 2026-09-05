import fs from "node:fs";
import path from "node:path";

export type DiscoveredApiRoute = {
  pattern: string;
  filePath: string;
  usesPermission: boolean;
};

function walkApiRoutes(dir: string, segments: string[] = []): DiscoveredApiRoute[] {
  const routes: DiscoveredApiRoute[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const name = entry.name;
    const full = path.join(dir, name);

    if (name.startsWith("(") && name.endsWith(")")) {
      routes.push(...walkApiRoutes(full, segments));
      continue;
    }

    const isDynamic = name.startsWith("[") && name.endsWith("]");
    const segment = isDynamic ? `[${name.slice(1, -1)}]` : name;
    const routeFile = path.join(full, "route.ts");

    if (fs.existsSync(routeFile)) {
      const source = fs.readFileSync(routeFile, "utf8");
      routes.push({
        pattern: `/api/${[...segments, segment].join("/")}`,
        filePath: routeFile,
        usesPermission: /\bpermission:\s*PERMISSIONS\[/.test(source),
      });
    }

    routes.push(...walkApiRoutes(full, [...segments, segment]));
  }

  return routes;
}

export function discoverApiRoutes(rootDir = path.join(process.cwd(), "src", "app", "api")): DiscoveredApiRoute[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }
  return walkApiRoutes(rootDir).sort((a, b) => a.pattern.localeCompare(b.pattern));
}
