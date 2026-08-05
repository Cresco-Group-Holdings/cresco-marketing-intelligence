import { z } from "zod";

const supabaseServerConfigSchema = z.object({
  url: z.string().url("Supabase URL must be a valid URL"),
  anonKey: z.string().min(1, "Supabase anon key is required"),
});

export type SupabaseServerConfig = z.infer<typeof supabaseServerConfigSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "supabase"}: ${issue.message}`)
    .join("\n");
}

export function readSupabaseServerConfigFromProcessEnv(): SupabaseServerConfig {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

  return { url, anonKey };
}

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const parsed = supabaseServerConfigSchema.safeParse(readSupabaseServerConfigFromProcessEnv());

  if (!parsed.success) {
    throw new Error(`Invalid Supabase server configuration:\n${formatZodError(parsed.error)}`);
  }

  return parsed.data;
}

export function getSupabaseConfigMetadata(config: SupabaseServerConfig = getSupabaseServerConfig()) {
  const url = new URL(config.url);

  return {
    hostSuffix: url.hostname.split(".").slice(-2).join("."),
    port: url.port || (url.protocol === "https:" ? "443" : "80"),
    protocol: url.protocol,
    anonKeyPresent: config.anonKey.length > 0,
    anonKeyLength: config.anonKey.length,
    usesRuntimeServerVars: Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY),
  };
}
