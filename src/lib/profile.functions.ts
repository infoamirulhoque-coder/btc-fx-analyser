import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,display_name,is_blocked").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
      isBlocked: !!profile?.is_blocked,
    };
  });
