"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Role = "super_admin" | "admin" | "staff";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  access: string[]; // section ids: "dashboard" | "product" | "tools"
  warehouse_scope: string[]; // warehouse ids this account is restricted to; empty = all
  is_active: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Why the last profile load failed (shown on the pending screen for diagnosis). */
  profileError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  try {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error || !data) return { profile: null, error: error?.message || "Profil tidak ditemukan." };
    return { profile: data as Profile, error: null };
  } catch (e) {
    return { profile: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (s?.user) {
      const res = await fetchProfile(s.user.id);
      setProfile(res.profile);
      setProfileError(res.error);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Never spin forever: if Supabase can't be reached (bad network, wrong
    // laptop clock, blocked domain), fall through to the login screen after
    // 10s, which then shows the real error when the user tries to sign in.
    const giveUp = setTimeout(() => { if (active) setLoading(false); }, 10000);

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session);
      clearTimeout(giveUp);
      if (active) setLoading(false);
    }).catch(() => {
      clearTimeout(giveUp);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return;
      setSession(s);
      await loadProfile(s);
    });

    return () => {
      active = false;
      clearTimeout(giveUp);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? error.message : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) return { error: error.message, needsConfirm: false };
    // If email confirmation is on, there is no active session yet.
    const needsConfirm = !data.session;
    return { error: null, needsConfirm };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut, refreshProfile, profileError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Access flag (stored in profiles.access alongside "warehouse") for accounts
 *  that may only view Multiwarehouse orders and open/print resi — e.g. interns. */
export const RESI_ONLY = "resi_only";

export function isResiOnly(profile: Profile | null): boolean {
  return !!profile && profile.role !== "super_admin" && profile.access.includes(RESI_ONLY);
}
