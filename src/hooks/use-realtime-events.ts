import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeNotifications(userId: string | undefined, onNotification?: () => void) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notifications_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("New notification received:", payload);
          if (onNotification) onNotification();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNotification]);
}
