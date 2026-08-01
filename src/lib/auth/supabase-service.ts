import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/environment";
import { getSupabaseServerConfig } from "@/lib/environment/supabase";

export function createSupabaseServiceClient() {
  const { url } = getSupabaseServerConfig();
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  return createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
