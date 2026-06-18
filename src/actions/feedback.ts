"use server";
import { createClient } from "@/lib/supabase/server";

export async function submitFeedback(input: {
  category: string;
  body: string;
  anonymous: boolean;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (!input.body.trim()) return { ok: false, error: "Feedback body is empty." };

  if (input.anonymous) {
    const { error } = await supabase.rpc("submit_anonymous_feedback", {
      p_category: input.category,
      p_body: input.body,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.rpc("submit_identified_feedback", {
      p_category: input.category,
      p_body: input.body,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
