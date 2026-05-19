import { createFileRoute, redirect } from "@tanstack/react-router";
import DevMindApp from "@/components/devmind/DevMindApp";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "DevMind — AI-Powered Software Development Intelligence" },
      {
        name: "description",
        content:
          "DevMind is an organizational brain for engineering teams — code review, bug prediction, sprint forecasting, knowledge graph, onboarding, and AI-generated docs.",
      },
      { property: "og:title", content: "DevMind — AI Dev Intelligence" },
      {
        property: "og:description",
        content:
          "Unified AI platform for devs, tech leads, and PMs. Context-aware reviews, risk prediction, knowledge graph, onboarding.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <DevMindApp />;
}
