import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MINERU_CLOUD_DEFAULT_BASE,
  PDF_PROVIDERS,
  getPDFProvider,
} from '../../lib/pdf/constants';
import { PDF_ENV_MAP } from '../../lib/server/provider-catalog';

test('mineru cloud is registered as a built-in PDF provider', () => {
  const provider = getPDFProvider('mineru-cloud');

  assert.ok(provider);
  assert.equal(provider, PDF_PROVIDERS['mineru-cloud']);
  assert.equal(provider?.requiresApiKey, true);
  assert.equal(provider?.baseUrl, MINERU_CLOUD_DEFAULT_BASE);
  assert.ok(provider?.features.includes('layout-analysis'));
  assert.equal(PDF_ENV_MAP.PDF_MINERU_CLOUD, 'mineru-cloud');
});
