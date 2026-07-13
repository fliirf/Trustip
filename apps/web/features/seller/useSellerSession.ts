"use client";

// Client-side Supabase Auth session for the seller area. Uses the existing
// anon browser client (session persisted by supabase-js); API calls carry the
// access token as a Bearer header — no cookie session, no new auth framework.

import { supabase } from "@trustip/database";
import { useCallback, useEffect, useState } from "react";

/** Session shape derived from the shared client — avoids a direct dependency
 * on @supabase/supabase-js in apps/web. */
type Session = NonNullable<
  Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
>;

export interface SellerSession {
  loading: boolean;
  session: Session | null;
  accessToken: string | null;
  email: string | null;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signUp(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}

export function useSellerSession(): SellerSession {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? error.message : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // Local/dev may auto-confirm; if not, the seller must confirm via email.
    // Sentinel (not a Supabase message) — translated at the render site via
    // `d.seller.login.confirmEmailNotice` so this hook stays locale-agnostic.
    if (!data.session) {
      return { error: "CONFIRM_EMAIL_NOTICE" };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    loading,
    session,
    accessToken: session?.access_token ?? null,
    email: session?.user?.email ?? null,
    signIn,
    signUp,
    signOut,
  };
}
