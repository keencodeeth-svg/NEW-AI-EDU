import { getRequestErrorMessage, getRequestStatus } from '@/lib/client-request';

const DASHBOARD_WARNING_LABELS: Record<string, string> = {
  abilities_unavailable: '能力画像',
  attempts_unavailable: '练习记录',
  badges_unavailable: '学习徽章',
  mastery_unavailable: '掌握度画像',
  plan_unavailable: '学习计划',
  plans_unavailable: '学习计划',
  profile_unavailable: '学生资料',
  schedule_unavailable: '课程表',
  streak_unavailable: '连续学习',
  today_tasks_unavailable: '今日任务',
  weekly_unavailable: '本周学习统计',
};

export function getStudentDashboardRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, '').trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return '学生登录状态已失效，请重新登录后继续查看学习控制台。';
  }
  if (lower === 'class not found' || (status === 404 && lower === 'not found')) {
    return '当前班级信息已失效，课表与任务会在重新加入班级后恢复。';
  }

  return getRequestErrorMessage(error, fallback);
}

export function getStudentDashboardJoinRequestMessage(error: unknown, fallback: string) {
  const status = getRequestStatus(error) ?? 0;
  const requestMessage = getRequestErrorMessage(error, '').trim();
  const lower = requestMessage.toLowerCase();

  if (status === 401 || status === 403) {
    return '学生登录状态已失效，请重新登录后继续加入班级。';
  }
  if (lower === 'missing code') {
    return '请输入邀请码后再提交。';
  }
  if (requestMessage === '邀请码无效' || (status === 404 && lower === 'not found')) {
    return '邀请码无效，请检查老师提供的邀请码后重试。';
  }
  if (requestMessage === '班级与学生学校不匹配') {
    return '该班级与当前学生账号不属于同一学校，暂时无法加入。';
  }

  return getRequestErrorMessage(error, fallback);
}

export function isMissingStudentDashboardClassError(error: unknown) {
  const status = getRequestStatus(error) ?? 0;
  const lower = getRequestErrorMessage(error, '').trim().toLowerCase();
  return lower === 'class not found' || (status === 404 && lower === 'not found');
}

export function extractStudentDashboardWarningLabels(
  payload:
    | {
        warnings?: string[] | null;
        data?:
          | {
              warnings?: string[] | null;
            }
          | Record<string, unknown>
          | null;
      }
    | null
    | undefined,
) {
  const nestedWarnings = Array.isArray(payload?.data?.warnings) ? payload.data.warnings : [];
  const warningCodes = [...(payload?.warnings ?? []), ...nestedWarnings];

  return Array.from(
    new Set(
      warningCodes
        .map((warning) => DASHBOARD_WARNING_LABELS[warning])
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function buildStudentDashboardDegradedNotice(labels: string[]) {
  const visibleLabels = Array.from(new Set(labels)).filter(Boolean);
  if (!visibleLabels.length) {
    return null;
  }

  const summary =
    visibleLabels.length > 3
      ? `${visibleLabels.slice(0, 3).join('、')}等模块`
      : visibleLabels.join('、');

  return `当前已切换为基础模式：${summary}暂时使用兜底数据。你仍可以继续查看学习入口、启动知序课堂，并推进今日学习。`;
}
