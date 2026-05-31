"use client";

import { useRef } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import { PLATFORM_PRODUCT_NAME } from "@/lib/classroom-integration";
import {
  loginPlaceholderMap,
  loginRegistrationMap,
  loginRoleOptions,
  useLoginPage
} from "./useLoginPage";

export default function LoginPage() {
  const loginPage = useLoginPage();
  const roleButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedRegistration = loginRegistrationMap[loginPage.role];
  const otherRegistrationLinks = loginRoleOptions
    .filter((option) => option.value !== loginPage.role)
    .map((option) => ({
      href: loginRegistrationMap[option.value].primaryHref,
      label: loginRegistrationMap[option.value].primaryLabel
    }));
  const errorId = loginPage.error ? "login-form-error" : undefined;

  const handleRoleKeyDown = (index: number, key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") {
      const nextIndex = (index + 1) % loginRoleOptions.length;
      loginPage.setField("role", loginRoleOptions[nextIndex].value);
      roleButtonRefs.current[nextIndex]?.focus();
      return true;
    }
    if (key === "ArrowLeft" || key === "ArrowUp") {
      const nextIndex = (index - 1 + loginRoleOptions.length) % loginRoleOptions.length;
      loginPage.setField("role", loginRoleOptions[nextIndex].value);
      roleButtonRefs.current[nextIndex]?.focus();
      return true;
    }
    if (key === "Home") {
      loginPage.setField("role", loginRoleOptions[0].value);
      roleButtonRefs.current[0]?.focus();
      return true;
    }
    if (key === "End") {
      const lastIndex = loginRoleOptions.length - 1;
      loginPage.setField("role", loginRoleOptions[lastIndex].value);
      roleButtonRefs.current[lastIndex]?.focus();
      return true;
    }
    return false;
  };

  return (
    <div className="grid auth-page" style={{ gap: 18, maxWidth: 520 }}>
      <div className="section-head auth-page-head">
        <div className="auth-page-copy">
          <h2>登录{PLATFORM_PRODUCT_NAME}</h2>
          <div className="section-sub">先确认当前身份，再进入对应的学习、教学、陪伴或管理主线。</div>
        </div>
        <span className="chip">账号中心</span>
      </div>
      <Card title="登录" tag="入口">
        <form onSubmit={loginPage.handleSubmit} className="auth-form">
          <fieldset className="auth-role-fieldset">
            <legend className="section-title">选择身份</legend>
            <p className="form-note auth-role-note">默认只展示当前身份最相关的注册入口，减少切换成本。</p>
            <div className="role-grid" role="radiogroup" aria-label="登录身份">
              {loginRoleOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(node) => {
                    roleButtonRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={loginPage.role === option.value}
                  tabIndex={loginPage.role === option.value ? 0 : -1}
                  className={`role-card${loginPage.role === option.value ? " active" : ""}`}
                  onClick={() => loginPage.setField("role", option.value)}
                  onKeyDown={(event) => {
                    if (handleRoleKeyDown(loginRoleOptions.indexOf(option), event.key)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <span className="sr-only">{loginPage.role === option.value ? "已选中" : "未选中"}</span>
                  <div className="role-title">{option.label}</div>
                  <div className="role-desc">{option.desc}</div>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={loginPage.email}
              onChange={(event) => loginPage.setField("email", event.target.value)}
              placeholder={loginPlaceholderMap[loginPage.role]}
              aria-invalid={Boolean(loginPage.error)}
              aria-describedby={errorId}
              required
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              autoComplete="current-password"
              value={loginPage.password}
              onChange={(event) => loginPage.setField("password", event.target.value)}
              placeholder="Student123"
              aria-invalid={Boolean(loginPage.error)}
              aria-describedby={errorId}
              required
            />
          </label>
          {loginPage.error ? (
            <div className="status-note error" id={errorId} role="alert" aria-live="assertive">
              {loginPage.error}
            </div>
          ) : null}
          <button className="button primary" type="submit" disabled={loginPage.loading}>
            {loginPage.loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="auth-support-stack">
          <div className="form-note auth-recovery-note">
            忘记密码、忘记账号或账号被锁定？<Link href="/recover">去发起恢复请求</Link>
          </div>
          <section className="auth-links" aria-labelledby="auth-register-title">
            <div className="auth-links-primary">
              <div className="section-title" id="auth-register-title">
                还没有账号？
              </div>
              <p className="form-note">{selectedRegistration.helper}</p>
              <Link className="button secondary auth-register-button" href={selectedRegistration.primaryHref}>
                {selectedRegistration.primaryLabel}
              </Link>
            </div>
            <details className="auth-register-details">
              <summary>其他身份注册入口</summary>
              <div className="auth-links-list">
                {otherRegistrationLinks.map((item) => (
                  <div key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </div>
                ))}
              </div>
            </details>
          </section>
        </div>
        <details className="auth-demo-details">
          <summary>内部演示账号</summary>
          <div className="auth-footnote">
            student@demo.com / Student123（可切换身份后登录）
          </div>
        </details>
      </Card>
    </div>
  );
}
