import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** 보드 초대용: 이메일로 사용자 ID 조회 (서비스 롤 전용, 로그인한 사용자만 호출 권장) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "email 쿼리가 필요합니다." },
      { status: 400 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      { error: "서버 설정이 올바르지 않습니다." },
      { status: 500 },
    );
  }

  const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { users },
    error,
  } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const user = users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    return NextResponse.json(
      { error: "해당 이메일로 가입한 사용자가 없습니다." },
      { status: 404 },
    );
  }
  return NextResponse.json({ userId: user.id });
}
