export type AuthErrorKind =
  | "network"
  | "invalidCredentials"
  | "emailConfirmation"
  | "userAlreadyExists"
  | "weakPassword"
  | "invalidInput"
  | "unknown";

export type AuthErrorInfo = {
  kind: AuthErrorKind;
  title: string;
  message: string;
};

function normalize(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const maybeMessage = (input as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return "";
}

export function toAuthErrorInfo(error: unknown): AuthErrorInfo {
  const msg = normalize(error);
  const msgLower = msg.toLowerCase();

  const anyErr = error as { code?: unknown; status?: unknown; statusCode?: unknown };
  const rawCode = typeof anyErr?.code === "string" ? anyErr.code.toLowerCase() : "";
  const status =
    typeof anyErr?.status === "number"
      ? anyErr.status
      : typeof anyErr?.statusCode === "number"
        ? anyErr.statusCode
        : undefined;

  const isNetwork =
    status === 404 ||
    msgLower.includes("failed to fetch") ||
    msgLower.includes("network error") ||
    msgLower.includes("err_name_not_resolved") ||
    msgLower.includes("name not resolved") ||
    msgLower.includes("dns") ||
    msgLower.includes("timeout") ||
    msgLower.includes("fetch");

  if (isNetwork) {
    return {
      kind: "network",
      title: "네트워크 오류",
      message:
        "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요. (인터넷 연결/방화벽/VPN 설정도 확인해 주세요.)",
    };
  }

  if (
    msgLower.includes("invalid login credentials") ||
    msgLower.includes("invalid password") ||
    msgLower.includes("incorrect") ||
    rawCode.includes("invalid_login_credentials")
  ) {
    return {
      kind: "invalidCredentials",
      title: "로그인 정보가 올바르지 않아요",
      message: "이메일 또는 비밀번호를 다시 확인해 주세요.",
    };
  }

  if (
    msgLower.includes("email not confirmed") ||
    msgLower.includes("not confirmed") ||
    msgLower.includes("confirmation") ||
    rawCode.includes("email_not_confirmed")
  ) {
    return {
      kind: "emailConfirmation",
      title: "이메일 인증이 필요해요",
      message:
        "회원가입 시 받은 인증 링크를 확인해 주세요. 인증이 완료되면 다시 로그인할 수 있습니다.",
    };
  }

  if (
    msgLower.includes("user already registered") ||
    msgLower.includes("already registered") ||
    rawCode.includes("user_already_exists")
  ) {
    return {
      kind: "userAlreadyExists",
      title: "이미 가입된 계정이에요",
      message: "해당 이메일로 이미 회원가입이 완료되었습니다. 로그인해 주세요.",
    };
  }

  if (
    msgLower.includes("password should") ||
    msgLower.includes("weak password") ||
    msgLower.includes("at least 6") ||
    rawCode.includes("weak_password") ||
    rawCode.includes("password_too_short")
  ) {
    return {
      kind: "weakPassword",
      title: "비밀번호 조건을 확인해 주세요",
      message: "비밀번호는 최소 6자 이상이어야 합니다.",
    };
  }

  if (
    msgLower.includes("invalid email") ||
    msgLower.includes("invalid input") ||
    rawCode.includes("invalid_input")
  ) {
    return {
      kind: "invalidInput",
      title: "입력값을 확인해 주세요",
      message: "이메일 형식이나 입력 정보를 다시 확인해 주세요.",
    };
  }

  // 최종 fallback: 사용자에게는 너무 기술적인 메시지를 그대로 노출하지 않기
  return {
    kind: "unknown",
    title: "요청 처리에 실패했어요",
    message: "잠시 후 다시 시도해 주세요.",
  };
}

