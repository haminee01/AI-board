import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "서버 설정이 올바르지 않습니다." },
      { status: 500 },
    );
  }

  const demoEmail =
    process.env.DEMO_EMAIL ??
    process.env.NEXT_PUBLIC_DEMO_EMAIL ??
    "test@test.com";
  const demoPassword =
    process.env.DEMO_PASSWORD ??
    process.env.NEXT_PUBLIC_DEMO_PASSWORD ??
    "qwer1234";

  const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { users },
    error: listError,
  } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const existing = users?.find(
    (u) => u.email?.toLowerCase() === demoEmail.toLowerCase(),
  );

  if (!existing) {
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
    });
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, created: true });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    existing.id,
    { password: demoPassword, email_confirm: true },
  );
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: false });
}
