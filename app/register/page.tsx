"use client";

import { useRef } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { PLATFORM_PRODUCT_NAME } from "@/lib/classroom-integration";
import { GRADE_OPTIONS } from "@/lib/constants";
import { useRegisterPage } from "./useRegisterPage";

const registerRoleOptions = [
  {
    value: "student" as const,
    label: "学生",
    desc: "加入班级、练习、课堂回看"
  },
  {
    value: "parent" as const,
    label: "家长",
    desc: "绑定孩子、查看周报和回执"
  }
];

export default function RegisterPage() {
  const registerPage = useRegisterPage();
  const roleButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const errorId = registerPage.error ? "register-form-error" : undefined;
  const successId = registerPage.message ? "register-form-success" : undefined;
  const roleHelper =
    registerPage.role === "student"
      ? "学生注册后可加入班级、进入练习与互动课堂。学校编码可由老师或学校提供，也可以注册后再绑定。"
      : "家长注册必须使用学生资料页生成的绑定码，系统不会只凭邮箱建立亲子关系。";

  const handleRoleKeyDown = (index: number, key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") {
      const nextIndex = (index + 1) % registerRoleOptions.length;
      registerPage.setField("role", registerRoleOptions[nextIndex].value);
      roleButtonRefs.current[nextIndex]?.focus();
      return true;
    }
    if (key === "ArrowLeft" || key === "ArrowUp") {
      const nextIndex = (index - 1 + registerRoleOptions.length) % registerRoleOptions.length;
      registerPage.setField("role", registerRoleOptions[nextIndex].value);
      roleButtonRefs.current[nextIndex]?.focus();
      return true;
    }
    if (key === "Home") {
      registerPage.setField("role", registerRoleOptions[0].value);
      roleButtonRefs.current[0]?.focus();
      return true;
    }
    if (key === "End") {
      const lastIndex = registerRoleOptions.length - 1;
      registerPage.setField("role", registerRoleOptions[lastIndex].value);
      roleButtonRefs.current[lastIndex]?.focus();
      return true;
    }
    return false;
  };

  return (
    <div className="grid auth-page" style={{ gap: 18, maxWidth: 620 }}>
      <div className="section-head auth-page-head">
        <div>
          <h2>注册{PLATFORM_PRODUCT_NAME}</h2>
          <div className="section-sub">学生与家长可自助注册；教师、学校与平台管理账号需通过邀请码或授权开通。</div>
        </div>
        <span className="chip">账号中心</span>
      </div>
      <Card title="注册" tag="账户">
        <div className="grid" style={{ gap: 10, marginBottom: 16 }}>
          <div className="status-note" role="note">
            学生与家长可自助注册
          </div>
          <div className="status-note" role="note">
            教师、学校管理员与平台管理员账号需通过邀请码、学校授权或平台授权开通
          </div>
          <div className="auth-links-list" aria-label="其他角色开通路径">
            <div>
              <Link href="/teacher/register?entry=register">教师账号开通</Link>
            </div>
            <div>
              <Link href="/school/register?entry=register">学校账号开通</Link>
            </div>
            <div>
              <Link href="/admin/register?entry=register">平台管理账号开通</Link>
            </div>
          </div>
        </div>
        <form onSubmit={registerPage.handleSubmit} className="auth-form">
          <fieldset className="auth-role-fieldset">
            <legend className="section-title">选择注册身份</legend>
            <p className="form-note auth-role-note">{roleHelper}</p>
            <div className="role-grid" role="radiogroup" aria-label="选择注册身份">
              {registerRoleOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(node) => {
                    roleButtonRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={registerPage.role === option.value}
                  tabIndex={registerPage.role === option.value ? 0 : -1}
                  className={`role-card${registerPage.role === option.value ? " active" : ""}`}
                  disabled={registerPage.loading}
                  onClick={() => registerPage.setField("role", option.value)}
                  onKeyDown={(event) => {
                    if (handleRoleKeyDown(registerRoleOptions.indexOf(option), event.key)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <span className="sr-only">{registerPage.role === option.value ? "已选中" : "未选中"}</span>
                  <div className="role-title">{option.label}</div>
                  <div className="role-desc">{option.desc}</div>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="form-field">
            <div className="section-title">姓名</div>
            <input
              className="form-control"
              autoComplete="name"
              value={registerPage.name}
              onChange={(event) => registerPage.setField("name", event.target.value)}
              aria-invalid={Boolean(registerPage.error)}
              aria-describedby={errorId}
              required
              disabled={registerPage.loading}
            />
          </label>
          <label className="form-field">
            <div className="section-title">邮箱</div>
            <input
              className="form-control"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={registerPage.email}
              onChange={(event) => registerPage.setField("email", event.target.value)}
              aria-invalid={Boolean(registerPage.error)}
              aria-describedby={errorId}
              required
              disabled={registerPage.loading}
            />
          </label>
          <label className="form-field">
            <div className="section-title">密码</div>
            <input
              className="form-control"
              type="password"
              autoComplete="new-password"
              value={registerPage.password}
              onChange={(event) => registerPage.setField("password", event.target.value)}
              aria-invalid={Boolean(registerPage.error)}
              aria-describedby={errorId}
              required
              disabled={registerPage.loading}
            />
            <PasswordPolicyHint />
          </label>
          {registerPage.role === "student" ? (
            <>
              <label className="form-field">
                <div className="section-title">年级</div>
                <select
                  className="form-control"
                  value={registerPage.grade}
                  onChange={(event) => registerPage.setField("grade", event.target.value)}
                  aria-invalid={Boolean(registerPage.error)}
                  aria-describedby={errorId}
                  required
                  disabled={registerPage.loading}
                >
                  {GRADE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <div className="section-title">学校编码（可选）</div>
                <input
                  className="form-control"
                  autoComplete="organization"
                  value={registerPage.schoolCode}
                  onChange={(event) => registerPage.setField("schoolCode", event.target.value)}
                  placeholder="可填写学校或老师提供的机构编码"
                  disabled={registerPage.loading}
                />
                <div className="form-note">没有编码也可以先注册，之后再由老师或学校完成班级绑定。</div>
              </label>
            </>
          ) : (
            <>
              <label className="form-field">
                <div className="section-title">绑定码</div>
                <input
                  className="form-control"
                  autoComplete="one-time-code"
                  value={registerPage.observerCode}
                  onChange={(event) => registerPage.setField("observerCode", event.target.value)}
                  placeholder="学生资料页获取绑定码"
                  aria-invalid={Boolean(registerPage.error)}
                  aria-describedby={errorId}
                  required
                  disabled={registerPage.loading}
                />
                <div className="form-note">家长注册必须使用学生资料页中的绑定码，避免仅凭邮箱误绑他人账号。</div>
              </label>
            </>
          )}

          {registerPage.error ? (
            <div className="status-note error" id={errorId} role="alert" aria-live="assertive">
              {registerPage.error}
            </div>
          ) : null}
          {registerPage.message ? (
            <div className="status-note success" id={successId} role="status" aria-live="polite">
              {registerPage.message}
            </div>
          ) : null}

          <button className="button primary" type="submit" disabled={registerPage.loading}>
            {registerPage.loading ? "提交中..." : "注册"}
          </button>
        </form>
        {registerPage.message ? (
          <div style={{ marginTop: 12 }}>
            <StatePanel
              compact
              tone="success"
              title="账号已创建"
              description="下一步使用刚注册的身份登录，然后完善班级、学习或绑定信息。"
              action={
                <Link className="button secondary" href={`/login?role=${registerPage.role}&entry=register`}>
                  去登录
                </Link>
              }
            />
          </div>
        ) : null}
        <div className="auth-support-stack">
          <section className="auth-links" aria-labelledby="register-support-title">
            <div className="auth-links-primary">
              <div className="section-title" id="register-support-title">
                已有账号？
              </div>
              <p className="form-note">直接回到对应身份登录；忘记密码、忘记账号或账号锁定时走恢复请求。</p>
              <Link className="button secondary auth-register-button" href={`/login?role=${registerPage.role}&entry=register`}>
                去登录
              </Link>
            </div>
            <div className="auth-links-list">
              <div>
                <Link href={`/recover?role=${registerPage.role}&entry=register`}>忘记账号或密码？去恢复</Link>
              </div>
              <div>
                教师、学校和平台管理账号按授权开通：
                <Link href="/teacher/register?entry=register">教师账号开通</Link> /{" "}
                <Link href="/school/register?entry=register">学校账号开通</Link> /{" "}
                <Link href="/admin/register?entry=register">平台管理账号开通</Link>
              </div>
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
}
