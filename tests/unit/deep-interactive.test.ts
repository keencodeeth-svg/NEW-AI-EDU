import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDeepInteractivePromptGuidance,
  normalizeDeepInteractiveOutline,
} from '../../lib/generation/deep-interactive';
import {
  normalizeQuizOutline,
  normalizeQuizQuestion,
  normalizeSceneOutlineRuntime,
} from '../../lib/generation/runtime-validators';

test('deep interactive guidance includes the Zhixu classroom widget contract', () => {
  const guidance = buildDeepInteractivePromptGuidance('deep-interactive');

  assert.match(guidance, /Interactive Classroom Mode/);
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

test('quiz outline normalization reads legacy text type and writes canonical short_answer', () => {
  const normalized = normalizeQuizOutline({
    id: 'quiz-1',
    type: 'quiz',
    title: 'Concept check',
    description: 'Check understanding',
    keyPoints: ['Explain the core idea'],
    order: 1,
    quizConfig: {
      questionCount: 3,
      difficulty: 'medium',
      questionTypes: ['single', 'text', 'short_answer'],
    },
  });

  assert.deepEqual(normalized.quizConfig?.questionTypes, ['single', 'short_answer']);
});

test('quiz question normalization reads legacy text and preserves canonical short_answer output', () => {
  const normalized = normalizeQuizQuestion({
    id: 'q1',
    type: 'text' as never,
    question: 'Explain why the result changes.',
    options: [{ value: 'A', label: 'Unused' }],
    answer: ['A'],
    analysis: 'Reference answer',
  });

  assert.equal(normalized.type, 'short_answer');
  assert.equal(normalized.options, undefined);
  assert.equal(normalized.answer, undefined);
});

test('interactive outline runtime normalization fills widgetType from widgetOutline and trims config strings', () => {
  const normalized = normalizeSceneOutlineRuntime({
    id: 'scene-2',
    type: 'interactive',
    title: 'Water cycle lab',
    description: 'Observe state changes.',
    keyPoints: ['Evaporation', 'Condensation'],
    order: 2,
    widgetOutline: {
      type: 'diagram',
      description: '  Reveal the water cycle step by step.  ',
    },
    interactiveConfig: {
      conceptName: '  ',
      conceptOverview: '  ',
      designIdea: '  ',
      subject: '  science ',
    },
  });

  assert.equal(normalized.widgetType, 'diagram');
  assert.deepEqual(normalized.widgetOutline, {
    type: 'diagram',
    description: '  Reveal the water cycle step by step.  ',
  });
  assert.equal(normalized.interactiveConfig?.conceptName, 'Water cycle lab');
  assert.equal(normalized.interactiveConfig?.conceptOverview, 'Observe state changes.');
  assert.equal(normalized.interactiveConfig?.designIdea, 'Observe state changes.');
  assert.equal(normalized.interactiveConfig?.subject, 'science');
});
