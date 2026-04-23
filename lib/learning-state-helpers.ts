const BREAK_SUGGESTION_DURATION_MS = 25 * 60 * 1000;

export function isBreakSuggestionNeeded(params: {
  sessionStartedAt: number;
  suggestionDismissed: boolean;
  now?: number;
}) {
  if (params.suggestionDismissed) {
    return false;
  }
  const now = params.now ?? Date.now();
  return now - params.sessionStartedAt >= BREAK_SUGGESTION_DURATION_MS;
}
