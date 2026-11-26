const asText = (value) => typeof value === 'string' ? value.trim() : '';

const asStringArray = (value) => Array.isArray(value)
  ? value.map(asText).filter(Boolean)
  : [];

const examSkillForActivity = (activityType) => {
  if (activityType === 'translation') return 'translation';
  if (['gap-fill', 'word-order', 'conjugation'].includes(activityType)) return 'grammar';
  if (activityType === 'free-response') return 'writing';
  return 'vocabulary';
};

const normalizeCorrection = (correction) => {
  if (!correction || typeof correction !== 'object') return null;
  const original = asText(correction.original);
  const corrected = asText(correction.corrected);
  const explanationEnglish = asText(correction.explanationEnglish || correction.explanation);
  if (!original && !corrected && !explanationEnglish) return null;
  return {
    original: original || 'Original answer',
    corrected: corrected || 'See explanation',
    explanationEnglish,
    category: asText(correction.category) || 'grammar',
  };
};

const normalizeSuggestion = (suggestion) => {
  if (!suggestion || typeof suggestion !== 'object') return null;
  const targetLanguage = asText(suggestion.targetLanguage || suggestion.suggestion);
  const englishMeaning = asText(suggestion.englishMeaning || suggestion.meaning);
  const whyUsefulEnglish = asText(suggestion.whyUsefulEnglish || suggestion.explanation);
  if (!targetLanguage && !englishMeaning && !whyUsefulEnglish) return null;
  return { targetLanguage, englishMeaning, whyUsefulEnglish };
};

export function normalizeTutorResult(rawResult) {
  if (!rawResult || typeof rawResult !== 'object') return null;
  const rawFeedback = rawResult.feedback;
  const feedbackObject = rawFeedback && typeof rawFeedback === 'object' && !Array.isArray(rawFeedback)
    ? rawFeedback
    : {};
  const legacyFeedback = asText(rawFeedback);
  const rawActivity = rawResult.activity && typeof rawResult.activity === 'object' ? rawResult.activity : {};
  const activityType = asText(rawActivity.type) || 'free-response';
  const summaryEnglish = asText(
    feedbackObject.summaryEnglish
    || feedbackObject.summary
    || feedbackObject.message
    || legacyFeedback,
  );
  const replyEnglish = asText(rawResult.replyEnglish || rawResult.reply || rawResult.message || summaryEnglish);
  const scoreValue = Number(rawResult.score);

  return {
    ...rawResult,
    replyEnglish,
    feedback: {
      summaryEnglish,
      whatWasDoneWellEnglish: asStringArray(
        feedbackObject.whatWasDoneWellEnglish
        || feedbackObject.whatWasDoneWell
        || feedbackObject.positives,
      ),
      corrections: Array.isArray(feedbackObject.corrections)
        ? feedbackObject.corrections.map(normalizeCorrection).filter(Boolean)
        : [],
      suggestions: Array.isArray(feedbackObject.suggestions)
        ? feedbackObject.suggestions.map(normalizeSuggestion).filter(Boolean)
        : [],
      modelAnswer: asText(feedbackObject.modelAnswer),
      modelAnswerEnglish: asText(feedbackObject.modelAnswerEnglish || feedbackObject.modelTranslation),
    },
    score: Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, Math.round(scoreValue))) : 0,
    activity: {
      ...rawActivity,
      type: activityType,
      instructionsEnglish: asText(rawActivity.instructionsEnglish || rawActivity.instructions),
      prompt: asText(rawActivity.prompt),
      promptLanguage: asText(rawActivity.promptLanguage) || 'mixed',
      options: asStringArray(rawActivity.options),
      tokens: asStringArray(rawActivity.tokens),
      expectedAnswer: asText(rawActivity.expectedAnswer),
      hintEnglish: asText(rawActivity.hintEnglish || rawActivity.hint),
      skillTag: asText(rawActivity.skillTag),
      examSkill: asText(rawActivity.examSkill) || examSkillForActivity(activityType),
      difficulty: asText(rawActivity.difficulty),
      focusWords: asStringArray(rawActivity.focusWords),
    },
    quickTipEnglish: asText(rawResult.quickTipEnglish || rawResult.quickTip),
  };
}

export function hasTutorFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object') return false;
  return Boolean(
    asText(feedback.summaryEnglish)
    || asText(feedback.modelAnswer)
    || asText(feedback.modelAnswerEnglish)
    || asStringArray(feedback.whatWasDoneWellEnglish).length
    || (Array.isArray(feedback.corrections) && feedback.corrections.length)
    || (Array.isArray(feedback.suggestions) && feedback.suggestions.length)
  );
}
