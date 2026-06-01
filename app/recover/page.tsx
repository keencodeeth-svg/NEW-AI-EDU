"use client";

import { useRef } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatePanel from "@/components/StatePanel";
import PasswordPolicyHint from "@/components/auth/PasswordPolicyHint";
import { formatLoadedTime } from "@/lib/client-request";
import type { RecoveryIssueType } from "./types";
import {
  recoveryIssueOptions,
  recoveryRoleOptions,
  useRecoverPage
} from "./useRecoverPage";

export default function RecoverPage() {
  const recoverPage = useRecoverPage();
  const roleButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const errorId = recoverPage.error ? "recover-form-error" : undefined;

  const handleRoleKeyDown = (index: number, key: string) => {
    if (key === "ArrowRight" || key === "ArrowDown") {
      const nextIndex = (index + 1) % recoveryRoleOptions.length;
      recoverPage.setField("role", recoveryRoleOptions[nextIndex].value);
      roleButtonRefs.current[nextIndex]?.focus();
      return true;
    }
    if (key === "ArrowLeft" || key === "ArrowUp") {
      const nextIndex = (index - 1 + recoveryRoleOptions.length) % recoveryRoleOptions.length;
      recoverPage.setField("role", recoveryRoleOptions[nextIndex].value);
      roleButtonRefs.current[nextIndex]?.focus();
      return true;
    }
    if (key === "Home") {
      recoverPage.setField("role", recoveryRoleOptions[0].value);
      roleButtonRefs.current[0]?.focus();
      return true;
    }
    if (key === "End") {
      const lastIndex = recoveryRoleOptions.length - 1;
      recoverPage.setField("role", recoveryRoleOptions[lastIndex].value);
      roleButtonRefs.current[lastIndex]?.focus();
      return true;
    }
    return false;
  };

  return (
    <div className="grid auth-page" style={{ gap: 18, maxWidth: 620 }}>
      <div className="section-head">
        <div>
          <h2>账号恢复</h2>
          <div className="section-sub">当你忘记密码、忘记账号或账号被临时锁定时，可在这里提交恢复请求。</div>
        </div>
        <span className="chip">恢复中心</span>
      </div>

      {recoverPage.result ? (
        <StatePanel
          title="恢复请求已受理"
          description={recoverPage.resultMessage}
          tone="success"
          action={
            <Link className="button secondary" href={recoverPage.loginHref}>
              返回{recoverPage.roleLabel}登录
            </Link>
          }
        >
          <div className="grid" style={{ gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
              请求编号：{recoverPage.result.ticketId ?? "--"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
              提交时间：{formatLoadedTime(recoverPage.result.submittedAt ?? null)}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-1)" }}>
              服务时效：{recoverPage.result.serviceLevel ?? "1 个工作日内处理"}
            </div>
            {recoverPage.result.nextSteps?.length ? (
              <ul style={{ margin: "4px 0 0 18px", color: "var(--ink-1)" }}>
                {recoverPage.result.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </StatePanel>
      ) : null}

      {!recoverPage.result ? (
      <Card title="提交恢复请求" tag="安全流程">
        <form onSubmit={recoverPage.handleSubmit} className="auth-form">
          <fieldset className="auth-role-fieldset">
            <legend className="section-title">选择恢复身份</legend>
            <p className="form-note auth-role-note">选择最接近当前账号的身份，管理员会按该身份核验信息。</p>
            <div className="role-grid" role="radiogroup" aria-label="选择恢复身份">
              {recoveryRoleOptions.map((option, index) => (
                <button
                  key={option.value}
                  ref={(node) => {
                    roleButtonRefs.current[index] = node;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={recoverPage.role === option.value}
                  tabIndex={recoverPage.role === option.value ? 0 : -1}
                  className={`role-card${recoverPage.role === option.value ? " active" : ""}`}
                  disabled={recoverPage.loading}
                  onClick={() => recoverPage.setField("role", option.value)}
                  onKeyDown={(event) => {
                    if (handleRoleKeyDown(index, event.key)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <span className="sr-only">{recoverPage.role === option.value ? "已选中" : "未选中"}</span>
                  <div className="role-title">{option.label}</div>
                  <div className="role-desc">{option.desc}</div>
                </button>
              ))}
            </div>
          </fieldset>

          <label className="form-field">
            <div className="section-title">问题类型</div>
            <select
              className="form-control"
              value={recoverPage.issueType}
              onChange={(event) => recoverPage.setField("issueType", event.target.value as RecoveryIssueType)}
              disabled={recoverPage.loading}
              aria-describedby={errorId}
            >
              {recoveryIssueOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} · {item.desc}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <div className="section-title">注册邮箱</div>
            <input
              className="form-control"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={recoverPage.email}
              onChange={(event) => recoverPage.setField("email", event.target.value)}
              placeholder="请输入注册时使用的邮箱"
              aria-invalid={Boolean(recoverPage.error)}
              aria-describedby={errorId}
              required
              disabled={recoverPage.loading}
            />
          </label>

          <label className="form-field">
            <div className="section-title">姓名（建议填写）</div>
            <input
              className="form-control"
              autoComplete="name"
              value={recoverPage.name}
              onChange={(event) => recoverPage.setField("name", event.target.value)}
              placeholder="方便管理员快速核对"
              disabled={recoverPage.loading}
            />
          </label>

          {recoverPage.role === "parent" ? (
            <label className="form-field">
              <div className="section-title">绑定学生邮箱（可选）</div>
              <input
                className="form-control"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={recoverPage.studentEmail}
                onChange={(event) => recoverPage.setField("studentEmail", event.target.value)}
                placeholder="若记得可填写，便于加快处理"
                disabled={recoverPage.loading}
                autoComplete="email"
              />
            </label>
          ) : null}

          {recoverPage.role === "teacher" || recoverPage.role === "school_admin" ? (
            <label className="form-field">
              <div className="section-title">学校名称（可选）</div>
              <input
                className="form-control"
                autoComplete="organization"
                value={recoverPage.schoolName}
                onChange={(event) => recoverPage.setField("schoolName", event.target.value)}
                placeholder="例如：知序实验学校"
                disabled={recoverPage.loading}
              />
            </label>
          ) : null}

          <label className="form-field">
            <div className="section-title">补充说明（可选）</div>
            <textarea
              className="form-control"
              rows={4}
              value={recoverPage.note}
              onChange={(event) => recoverPage.setField("note", event.target.value)}
              placeholder="例如：登录被锁定、换了设备、忘记使用哪个邮箱注册等"
              disabled={recoverPage.loading}
            />
          </label>

          <PasswordPolicyHint />
          {recoverPage.error ? (
            <div className="status-note error" id={errorId} role="alert" aria-live="assertive">
              {recoverPage.error}
            </div>
          ) : null}

          <button className="button primary" type="submit" disabled={recoverPage.loading || !recoverPage.email.trim()}>
            {recoverPage.loading ? "提交中..." : "提交恢复请求"}
          </button>
        </form>

        <div className="auth-links">
          <div>
            想直接登录？<Link href={recoverPage.loginHref}>返回{recoverPage.roleLabel}登录</Link>
          </div>
          <div>
            还没有账号？<Link href={recoverPage.registrationHref}>查看{recoverPage.roleLabel}开通方式</Link>
          </div>
        </div>
      </Card>
      ) : null}
    </div>
  );
}
