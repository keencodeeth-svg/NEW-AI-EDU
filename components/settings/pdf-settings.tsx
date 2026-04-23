'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { PDF_PROVIDERS } from '@/lib/pdf/constants';
import type { PDFProviderId } from '@/lib/pdf/types';
import { CheckCircle2, Eye, EyeOff, Loader2, Zap, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getClientProviderUiState } from '@/lib/provider-request-config';
import { ProviderPolicyNotice } from './provider-policy-notice';

/**
 * Get display label for feature
 */
function getFeatureLabel(feature: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    text: t('settings.featureText'),
    images: t('settings.featureImages'),
    tables: t('settings.featureTables'),
    formulas: t('settings.featureFormulas'),
    'layout-analysis': t('settings.featureLayoutAnalysis'),
    metadata: t('settings.featureMetadata'),
  };
  return labels[feature] || feature;
}

interface PDFSettingsProps {
  selectedProviderId: PDFProviderId;
}

export function PDFSettings({ selectedProviderId }: PDFSettingsProps) {
  const { t } = useI18n();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const pdfProvidersConfig = useSettingsStore((state) => state.pdfProvidersConfig);
  const setPDFProviderConfig = useSettingsStore((state) => state.setPDFProviderConfig);

  const pdfProvider = PDF_PROVIDERS[selectedProviderId];
  const isServerConfigured = !!pdfProvidersConfig[selectedProviderId]?.isServerConfigured;
  const providerConfig = pdfProvidersConfig[selectedProviderId];
  const { canEditSecrets, effectiveBaseUrl, requestConfig } =
    getClientProviderUiState(providerConfig, pdfProvider?.baseUrl);
  const effectiveConfiguredBaseUrl = effectiveBaseUrl;
  const hasBaseUrl = !!effectiveConfiguredBaseUrl;
  const needsRemoteConfig =
    selectedProviderId === 'mineru' || selectedProviderId === 'mineru-cloud';
  const hasRequiredCredentials =
    !pdfProvider.requiresApiKey || !!requestConfig.apiKey || isServerConfigured;

  // Reset state when provider changes
  const [prevSelectedProviderId, setPrevSelectedProviderId] = useState(selectedProviderId);
  if (selectedProviderId !== prevSelectedProviderId) {
    setPrevSelectedProviderId(selectedProviderId);
    setShowApiKey(false);
    setTestStatus('idle');
    setTestMessage('');
  }

  const handleTestConnection = async () => {
    if (!hasBaseUrl) return;

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch('/api/verify-pdf-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProviderId,
          ...(requestConfig.apiKey ? { apiKey: requestConfig.apiKey } : {}),
          ...(requestConfig.baseUrl ? { baseUrl: requestConfig.baseUrl } : {}),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestStatus('success');
        setTestMessage(t('settings.connectionSuccess'));
      } else {
        setTestStatus('error');
        setTestMessage(`${t('settings.connectionFailed')}: ${data.error}`);
      }
    } catch (err) {
      setTestStatus('error');
      const message = err instanceof Error ? err.message : String(err);
      setTestMessage(`${t('settings.connectionFailed')}: ${message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ProviderPolicyNotice
        isServerConfigured={isServerConfigured}
        browserOverridesDisabled={(needsRemoteConfig || isServerConfigured) && !canEditSecrets}
      />

      {/* Base URL + API Key Configuration (for remote providers like MinerU) */}
      {(needsRemoteConfig || isServerConfigured) && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">{t('settings.pdfBaseUrl')}</Label>
              <div className="flex gap-2">
                <Input
                  name={`pdf-base-url-${selectedProviderId}`}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={
                    canEditSecrets
                      ? providerConfig?.serverBaseUrl ||
                        pdfProvider?.baseUrl ||
                        'http://localhost:8080'
                      : t('settings.browserOverridesDisabledShort')
                  }
                  value={providerConfig?.baseUrl || ''}
                  onChange={(e) =>
                    setPDFProviderConfig(selectedProviderId, { baseUrl: e.target.value })
                  }
                  disabled={!canEditSecrets}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing' || !hasBaseUrl || !hasRequiredCredentials}
                  className="gap-1.5 shrink-0"
                >
                  {testStatus === 'testing' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      {t('settings.testConnection')}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                {t('settings.pdfApiKey')}
                {!pdfProvider.requiresApiKey && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    ({t('settings.optional')})
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  name={`pdf-api-key-${selectedProviderId}`}
                  type={showApiKey ? 'text' : 'password'}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={
                    canEditSecrets
                      ? isServerConfigured
                        ? t('settings.optionalOverride')
                        : t('settings.enterApiKey')
                      : t('settings.browserOverridesDisabledShort')
                  }
                  value={providerConfig?.apiKey || ''}
                  onChange={(e) =>
                    setPDFProviderConfig(selectedProviderId, {
                      apiKey: e.target.value,
                    })
                  }
                  disabled={!canEditSecrets}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  disabled={!canEditSecrets}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Test result message */}
          {testMessage && (
            <div
              className={cn(
                'rounded-lg p-3 text-sm',
                testStatus === 'success' &&
                  'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800',
                testStatus === 'error' &&
                  'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
              )}
            >
              <div className="flex items-center gap-2">
                {testStatus === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                {testStatus === 'error' && <XCircle className="h-4 w-4 shrink-0" />}
                <span className="break-all">{testMessage}</span>
              </div>
            </div>
          )}

          {/* Request URL Preview */}
          {(() => {
            const effectiveBaseUrl = effectiveConfiguredBaseUrl;
            if (!effectiveBaseUrl) return null;
            const fullUrl =
              effectiveBaseUrl +
              (selectedProviderId === 'mineru-cloud' ? '/file-urls/batch' : '/file_parse');
            return (
              <p className="text-xs text-muted-foreground break-all">
                {t('settings.requestUrl')}: {fullUrl}
              </p>
            );
          })()}
        </>
      )}

      {/* Features List */}
      <div className="space-y-2">
        <Label className="text-sm">{t('settings.pdfFeatures')}</Label>
        <div className="flex flex-wrap gap-2">
          {pdfProvider.features.map((feature) => (
            <Badge key={feature} variant="secondary" className="font-normal">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {getFeatureLabel(feature, t)}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
