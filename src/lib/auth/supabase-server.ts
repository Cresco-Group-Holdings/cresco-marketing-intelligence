import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logSignupCatch, logSignupTrace } from "@/lib/auth/signup-trace";
import { getSupabaseServerConfig } from "@/lib/environment/supabase";

export async function createSupabaseServerClient(requestId?: string) {
  if (requestId) {
    logSignupTrace("ENTER createSupabaseServerClient", requestId);
  }

  try {
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseServerConfig();

    const client = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            if (requestId) {
              logSignupCatch("createSupabaseServerClient.setAll", requestId, error);
            }
          }
        },
      },
    });

    if (requestId) {
      logSignupTrace("EXIT createSupabaseServerClient", requestId);
    }

    return client;
  } catch (error) {
    if (requestId) {
      logSignupCatch("createSupabaseServerClient", requestId, error);
    }
    throw error;
  }
}
