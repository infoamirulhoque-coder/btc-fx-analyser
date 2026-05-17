import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const supabase = context.supabase;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,is_blocked").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
      isBlocked: !!profile?.is_blocked,
    };
  });
