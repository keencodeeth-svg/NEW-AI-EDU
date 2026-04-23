import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDeepInteractivePromptGuidance,
  normalizeDeepInteractiveOutline,
} from '../../lib/generation/deep-interactive';

test('deep interactive guidance includes the OpenMAIC-style widget contract', () => {
  const guidance = buildDeepInteractivePromptGuidance('deep-interactive');

  assert.match(guidance, /Deep Interactive Mode/);
  assert.match(guidance, /widgetType/);
  assert.match(guidance, /widgetOutline/);
  assert.match(guidance, /simulation/);
  assert.match(guidance, /game/);
});

test('deep interactive outline normalization backfills interactiveConfig from widget outline', () => {
  const normalized = normalizeDeepInteractiveOutline({
    id: 'scene-1',
    type: 'interactive',
    title: 'Build a force simulator',
    description: 'Students explore how mass and acceleration change force.',
    keyPoints: ['Newton second law'],
    order: 1,
    widgetType: 'simulation',
    widgetOutline: {
      type: 'simulation',
      concept: 'Newton second law',
      description: 'Drag sliders and watch the force update in real time.',
      subject: 'physics',
      sliders: ['mass', 'acceleration'],
    },
  });

  assert.equal(normalized.interactiveConfig?.conceptName, 'Newton second law');
  assert.equal(
    normalized.interactiveConfig?.conceptOverview,
    'Drag sliders and watch the force update in real time.',
  );
  assert.equal(normalized.interactiveConfig?.subject, 'physics');
  assert.match(normalized.interactiveConfig?.designIdea || '', /Widget outline JSON/);
  assert.equal(normalized.widgetType, 'simulation');
});
