import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GM_FAKE_EMAIL_DOMAIN = "artisan-codex.local";

function usernameToFakeEmail(username: string) {
  const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${cleaned}@${GM_FAKE_EMAIL_DOMAIN}`;
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [type, token] = authHeader.split(" ");
  return type?.toLowerCase() === "bearer" ? token : "";
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      );
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid auth token." }, { status: 401 });
    }

    const { data: requesterProfile, error: profileError } = await adminClient
      .from("gm_profiles")
      .select("id,is_site_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !requesterProfile?.is_site_admin) {
      return NextResponse.json(
        { error: "Only the site admin can create GM accounts." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.displayName || "").trim();

    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Temporary password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const email = usernameToFakeEmail(username);

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          display_name: displayName || username,
          must_change_password: true,
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || "Failed to create user." },
        { status: 400 }
      );
    }

    const { error: profileUpsertError } = await adminClient
      .from("gm_profiles")
      .upsert(
        {
          id: created.user.id,
          username,
          display_name: displayName || username,
          is_site_admin: false,
        },
        { onConflict: "id" }
      );

    if (profileUpsertError) {
      return NextResponse.json(
        { error: profileUpsertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      id: created.user.id,
      username,
      email,
      displayName: displayName || username,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error." },
      { status: 500 }
    );
  }
}
