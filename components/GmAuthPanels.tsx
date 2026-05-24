"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  changeOwnGmPassword,
  getCurrentGmProfile,
  signInGm,
  signOutGm,
} from "@/lib/supabaseAuth";

type GmAuthState = {
  userId: string;
  username: string;
  displayName: string;
  isSiteAdmin: boolean;
  mustChangePassword: boolean;
};

export function GmLoginPanel({
  onAuthChange,
}: {
  onAuthChange: (state: GmAuthState | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authState, setAuthState] = useState<GmAuthState | null>(null);
  const [message, setMessage] = useState("");

  async function refreshAuthState() {
    const current = await getCurrentGmProfile();

    if (!current) {
      setAuthState(null);
      onAuthChange(null);
      return;
    }

    const next = {
      userId: current.user.id,
      username: current.profile.username,
      displayName: current.profile.display_name || current.profile.username,
      isSiteAdmin: Boolean(current.profile.is_site_admin),
      mustChangePassword: Boolean(current.user.user_metadata?.must_change_password),
    };

    setAuthState(next);
    onAuthChange(next);
  }

  useEffect(() => {
    refreshAuthState().catch(() => {
      setAuthState(null);
      onAuthChange(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      refreshAuthState().catch(() => {
        setAuthState(null);
        onAuthChange(null);
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin() {
    setMessage("");

    try {
      await signInGm(username, password);
      setPassword("");
      await refreshAuthState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function handleLogout() {
    setMessage("");
    await signOutGm();
    setAuthState(null);
    onAuthChange(null);
  }

  async function handleChangePassword() {
    setMessage("");

    try {
      if (newPassword.length < 8) {
        setMessage("New password must be at least 8 characters.");
        return;
      }

      await changeOwnGmPassword(newPassword);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch("/api/gm/mark-password-changed", {
        method: "POST",
        headers: {
          authorization: `Bearer ${session?.access_token}`,
        },
      });

      setNewPassword("");
      setMessage("Password changed.");
      await refreshAuthState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password change failed.");
    }
  }

  if (authState) {
    return (
      <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-3 font-serif text-[#251b10]">
        <div>
          <strong>Signed in as:</strong> {authState.displayName}
          {authState.isSiteAdmin && <span> • Site Admin</span>}
        </div>

        {authState.mustChangePassword && (
          <div className="rounded-lg border border-[#c97716] bg-[#ffe0a3] p-3 space-y-2">
            <strong>Password change required</strong>
            <input
              className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <button
              className="rounded bg-[#4b3115] px-4 py-2 text-[#fff0c7]"
              onClick={handleChangePassword}
            >
              Change Password
            </button>
          </div>
        )}

        {message && <p>{message}</p>}

        <button
          className="rounded bg-[#4b3115] px-4 py-2 text-[#fff0c7]"
          onClick={handleLogout}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-3 font-serif text-[#251b10]">
      <h3 className="text-xl font-bold">GM Sign In</h3>

      <input
        className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <input
        className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") handleLogin();
        }}
      />

      {message && <p>{message}</p>}

      <button
        className="rounded bg-[#4b3115] px-4 py-2 text-[#fff0c7]"
        onClick={handleLogin}
      >
        Sign In
      </button>
    </div>
  );
}

export function CreateGmPanel({ isSiteAdmin }: { isSiteAdmin: boolean }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");

  if (!isSiteAdmin) return null;

  async function createGm() {
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/admin/create-gm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          username,
          displayName,
          password: temporaryPassword,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Failed to create GM.");
      }

      setMessage(`Created GM: ${body.username}`);
      setUsername("");
      setDisplayName("");
      setTemporaryPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create GM.");
    }
  }

  return (
    <div className="rounded-xl border border-[#9a7b45] bg-[#f2dfb9] p-4 space-y-3 font-serif text-[#251b10]">
      <h3 className="text-xl font-bold">Site Admin: Create Temporary GM Login</h3>

      <input
        className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
        placeholder="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <input
        className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
        placeholder="Display name"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />

      <input
        className="w-full rounded border border-[#9a7b45] bg-[#fff0c7] p-2"
        type="password"
        placeholder="Temporary password"
        value={temporaryPassword}
        onChange={(event) => setTemporaryPassword(event.target.value)}
      />

      {message && <p>{message}</p>}

      <button
        className="rounded bg-[#4b3115] px-4 py-2 text-[#fff0c7]"
        onClick={createGm}
      >
        Create GM
      </button>
    </div>
  );
}
