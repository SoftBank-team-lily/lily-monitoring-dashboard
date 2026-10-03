"use client";

import { useI18n } from "@/lib/i18n/provider";
import { useEffect } from 'react';

/** Next의 basePath가 로그인 경로에 붙지 않도록 공개 origin의 경로로 이동한다. */
export function LoginRedirect({ href }: { href: string }) {
  const { t } = useI18n();
  useEffect(() => { window.location.replace(href); }, [href]);
  return <p>{t("로그인 상태를 확인했어요.")}{" "}<a href={href}>{t("인증 화면으로 이동")}</a></p>;
}
