'use client';

import { useI18n } from '@/lib/hooks/use-i18n';

interface ProviderPolicyNoticeProps {
  isServerConfigured?: boolean;
  browserOverridesDisabled?: boolean;
}

export function ProviderPolicyNotice({
  isServerConfigured = false,
  browserOverridesDisabled = false,
}: ProviderPolicyNoticeProps) {
  const { t } = useI18n();

  if (!isServerConfigured && !browserOverridesDisabled) {
    return null;
  }

  return (
    <div className="space-y-2">
      {isServerConfigured && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
          {t('settings.serverConfiguredNotice')}
        </div>
      )}
      {browserOverridesDisabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {t('settings.browserOverridesDisabledNotice')}
        </div>
      )}
    </div>
  );
}
