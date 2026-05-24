import { supabase } from "./supabaseClient";

export const GM_FAKE_EMAIL_DOMAIN = "artisan-codex.local";

export function usernameToFakeEmail(username: string) {
  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${cleaned}@${GM_FAKE_EMAIL_DOMAIN}`;
}

export async function signInGm(username: string, password: string) {
  const email = usernameToFakeEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOutGm() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentGmProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("gm_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  return {
    user,
    profile: data,
  };
}

export async function changeOwnGmPassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
  return data;
}
