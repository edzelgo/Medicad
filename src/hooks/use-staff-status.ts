import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useStaffStatus() {
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        if (!cancelled) setIsStaff(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "agent"]);
      const hasStaffRole = (roles ?? []).length > 0;
      if (!cancelled) setIsStaff(hasStaffRole);
    }
    check().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      check().finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    });
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  return { isStaff, isLoading };
}
