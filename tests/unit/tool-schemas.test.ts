import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActionDescriptions } from '../../lib/orchestration/tool-schemas';

test('whiteboard code actions are described for prompt building', () => {
  const descriptions = getActionDescriptions(['wb_draw_code', 'wb_edit_code']);

  assert.match(descriptions, /wb_draw_code/);
  assert.match(descriptions, /syntax highlighting/);
  assert.match(descriptions, /wb_edit_code/);
  assert.match(descriptions, /line-by-line/);
});
