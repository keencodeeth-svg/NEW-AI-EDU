"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics-client";
import {
  getRequestErrorMessage,
  getRequestErrorPayload,
  getRequestStatus,
  requestJson
} from "@/lib/client-request";
import type { LoginErrorPayload, LoginRole, LoginSuccessPayload } from "./types";

type LoginFormState = {
  role: LoginRole;
  email: string;
  password: string;
};

export const loginRoleOptions = [
  { value: "student" as const, label: "学生", desc: "今日学习与自主课堂" },
  { value: "teacher" as const, label: "教师", desc: "课堂准备与班级反馈" },
  { value: "parent" as const, label: "家长", desc: "陪伴动作与回执" },
  { value: "admin" as const, label: "管理员", desc: "平台配置与质量观察" },
  { value: "school_admin" as const, label: "学校管理员", desc: "课堂质量与组织覆盖" }
];

export const loginRegistrationMap: Record<
  LoginRole,
  { primaryHref: string; primaryLabel: string; helper: string }
> = {
  student: {
    primaryHref: "/register?role=student&entry=login",
    primaryLabel: "学生注册",
    helper: "适合学生本人创建学习账号。"
  },
  teacher: {
    primaryHref: "/teacher/register?entry=login&role=teacher",
    primaryLabel: "教师账号开通方式",
    helper: "教师账号需要学校邀请码或平台授权后开通。"
  },
  parent: {
    primaryHref: "/register?role=parent&entry=login",
    primaryLabel: "家长注册",
    helper: "用于接收陪伴动作、回执与学习反馈。"
  },
  admin: {
    primaryHref: "/admin/register?entry=login&role=admin",
    primaryLabel: "平台管理账号开通方式",
    helper: "平台管理账号仅面向经授权的运营与平台人员开放。"
  },
  school_admin: {
    primaryHref: "/school/register?entry=login&role=school_admin",
    primaryLabel: "学校账号开通方式",
    helper: "学校管理员账号需要学校授权或邀请码后开通。"
  }
};

export const loginRoleLabelMap: Record<LoginRole, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
  school_admin: "学校管理员"
};

export const loginPlaceholderMap: Record<LoginRole, string> = {
  student: "请输入学生账号邮箱",
  teacher: "请输入教师账号邮箱",
  parent: "请输入家长账号邮箱",
  admin: "请输入管理员账号邮箱",
  school_admin: "请输入学校管理员账号邮箱"
};

function formatLockUntil(lockUntil?: string | null) {
  if (!lockUntil) return "";
  const value = new Date(lockUntil);
  if (Number.isNaN(value.getTime())) return lockUntil;
  return value.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function resolveLoginErrorMessage(payload: LoginErrorPayload, status: number) {
  const rawError = payload.error ?? "";
  if (
    rawError.includes("安全初始化") ||
    rawError.includes("旧密码格式") ||
    rawError.includes("legacy password disabled")
  ) {
    return "当前测试账号尚未完成安全初始化，请联系管理员刷新测试数据后重试。";
  }

  if (rawError.includes("same-origin request required")) {
    return "当前登录请求校验失败，请刷新页面后重试。";
  }

  const lockUntil = formatLockUntil(payload.details?.lockUntil);
  if (status === 429) {
    return lockUntil
      ? `登录失败次数过多，账号已临时锁定至 ${lockUntil}。`
      : "登录失败次数过多，账号已临时锁定，请稍后再试。";
  }

  const remainingAttempts = payload.details?.remainingAttempts;
  if (typeof remainingAttempts === "number") {
    if (remainingAttempts <= 1) {
      return "邮箱或密码错误，再错 1 次账号将被临时锁定。";
    }
    return `邮箱或密码错误，还可再尝试 ${remainingAttempts} 次。`;
  }

  if (status >= 500) {
    return "当前服务正在准备中，请稍后再试；如果持续失败，请联系管理员检查系统配置。";
  }

  return payload.error ?? "登录失败";
}

function getLoginTarget(role: LoginRole) {
  if (role === "admin") {
    return "/admin";
  }
  if (role === "teacher") {
    return "/teacher";
  }
  if (role === "parent") {
    return "/parent";
  }
  if (role === "school_admin") {
    return "/school";
  }
  return "/student";
}

export function useLoginPage() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<LoginFormState>({
    role: "student",
    email: "",
    password: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setField = useCallback(<K extends keyof LoginFormState>(field: K, value: LoginFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  useEffect(() => {
    trackEvent({
      eventName: "login_page_view",
      page: "/login",
      props: {
        entry: searchParams.get("entry") ?? "direct",
        preselectedRole: searchParams.get("role") ?? null
      }
    });
  }, [searchParams]);

  useEffect(() => {
    const nextRole = searchParams.get("role");
    if (
      nextRole === "student" ||
      nextRole === "teacher" ||
      nextRole === "parent" ||
      nextRole === "admin" ||
      nextRole === "school_admin"
    ) {
      setField("role", nextRole);
    }
  }, [searchParams, setField]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);

      try {
        const normalizedEmail = form.email.trim();
        const payload = await requestJson<LoginSuccessPayload>("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            password: form.password,
            role: form.role
          })
        });

        trackEvent({
          eventName: "login_success",
          page: "/login",
          entityId: payload.role ?? form.role,
          props: {
            selectedRole: form.role,
            actualRole: payload.role ?? form.role
          }
        });

        window.location.assign(getLoginTarget(payload.role ?? form.role));
      } catch (nextError) {
        const payload = getRequestErrorPayload<LoginErrorPayload>(nextError);
        const status = getRequestStatus(nextError) ?? 0;

        trackEvent({
          eventName: "login_failed",
          page: "/login",
          entityId: form.role,
          props: {
            selectedRole: form.role,
            status,
            error: payload?.error ?? getRequestErrorMessage(nextError, "登录失败"),
            remainingAttempts: payload?.details?.remainingAttempts ?? null,
            lockUntil: payload?.details?.lockUntil ?? null
          }
        });

        setError(resolveLoginErrorMessage(payload ?? {}, status));
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return {
    role: form.role,
    email: form.email,
    password: form.password,
    error,
    loading,
    setField,
    handleSubmit
  };
}
