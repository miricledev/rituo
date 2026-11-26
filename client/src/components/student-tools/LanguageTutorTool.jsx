import React, { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiAward,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiEdit3,
  FiLoader,
  FiMessageCircle,
  FiRefreshCw,
  FiSend,
  FiShuffle,
  FiTarget,
  FiTrendingUp,
} from 'react-icons/fi';
import api from '../../services/api';
import { getDeviceTimezone } from '../../utils/deviceTimezone';
import { hasTutorFeedback, normalizeTutorResult } from '../../utils/tutorResponse';

const FALLBACK_CONFIG = {
  dailyLimit: 15,
  examBoards: [
    {
      id: 'mixed',
      label: 'Not sure / mixed GCSE',
      description: 'Build broad GCSE language confidence while you confirm your exam board.',
      topics: [
        { id: 'identity-relationships', label: 'Identity, family and relationships', theme: 'General GCSE' },
        { id: 'school-future', label: 'School, education and future plans', theme: 'General GCSE' },
        { id: 'lifestyle-wellbeing', label: 'Lifestyle, health and wellbeing', theme: 'General GCSE' },
        { id: 'free-time-culture', label: 'Free time, culture and celebrations', theme: 'General GCSE' },
        { id: 'travel-tourism', label: 'Travel and tourism', theme: 'General GCSE' },
      ],
    },
  ],
  grammarFocuses: ['Mixed grammar', 'Present tense', 'Perfect / preterite past', 'Near future', 'Irregular verbs'],
  activityPreferences: ['Mixed practice', 'Gap fills', 'Word ordering', 'Verb conjugation', 'Translation', 'Multiple choice', 'Free response'],
  tiers: ['foundation', 'higher', 'stretch'],
};

const BOARD_BADGES = {
  aqa: 'A',
  edexcel: 'E',
  eduqas: 'W',
  mixed: '?',
};

const CATEGORY_LABELS = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  spelling: 'Spelling',
  'word-order': 'Word order',
  accent: 'Accent',
  meaning: 'Meaning',
};

function createInitialSettings(config) {
  const firstBoard = config.examBoards?.[0] || FALLBACK_CONFIG.examBoards[0];
  return {
    examBoard: firstBoard.id,
    examBoardLabel: firstBoard.label,
    topicId: 'random',
    topic: 'Random exam topic',
    topicTheme: 'Tutor chooses from this board',
    grammarFocus: config.grammarFocuses?.[0] || 'Mixed grammar',
    tier: config.tiers?.[0] || 'foundation',
    activityPreference: config.activityPreferences?.[0] || 'Mixed practice',
    confidence: 'Building confidence',
  };
}

function TypingDots({ language }) {
  return (
    <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
      <span>{language} tutor is marking and preparing</span>
      <span className="flex gap-1">{[0, 1, 2].map((index) => <i key={index} style={{ animationDelay: `${index * 150}ms` }} className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" />)}</span>
    </div>
  );
}

function LanguageTutorTool({
  groupId,
  language = 'Spanish',
  testMode = false,
  aiEndpoint = '',
  tutorConfig,
  initialUsage,
  onUsageChange = () => {},
}) {
  const config = tutorConfig?.examBoards?.length ? tutorConfig : FALLBACK_CONFIG;
  const toolId = `${language.toLowerCase()}-tutor`;
  const [settings, setSettings] = useState(() => createInitialSettings(config));
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [answer, setAnswer] = useState('');
  const [orderedTokens, setOrderedTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heroAvailable, setHeroAvailable] = useState(true);
  const [usage, setUsage] = useState(() => initialUsage || {
    used: 0,
    remaining: config.dailyLimit || 15,
    limit: config.dailyLimit || 15,
    timezone: getDeviceTimezone(),
  });

  const languageCode = language === 'Spanish' ? 'ES' : 'FR';
  const accent = language === 'Spanish' ? 'from-amber-400 via-rose-500 to-violet-700' : 'from-blue-500 via-indigo-600 to-rose-500';
  const heroPath = `/images/tutors/${language.toLowerCase()}-gcse-hero.webp`;
  const selectedBoard = config.examBoards.find((board) => board.id === settings.examBoard) || config.examBoards[0];
  const topicOptions = useMemo(() => [
    { id: 'random', label: 'Random exam topic', theme: 'Tutor chooses from this board' },
    ...(selectedBoard?.topics || []),
  ], [selectedBoard]);
  const selectedTokenIndexes = useMemo(() => new Set(orderedTokens.map((item) => item.index)), [orderedTokens]);
  const limitReached = !testMode && usage.remaining <= 0;

  useEffect(() => {
    if (initialUsage) setUsage(initialUsage);
  }, [initialUsage]);

  useEffect(() => {
    const board = config.examBoards.find((item) => item.id === settings.examBoard);
    if (!board) setSettings(createInitialSettings(config));
  }, [config, settings.examBoard]);

  useEffect(() => setHeroAvailable(true), [language]);

  const selectBoard = (board) => {
    setSettings((current) => ({
      ...current,
      examBoard: board.id,
      examBoardLabel: board.label,
      topicId: 'random',
      topic: 'Random exam topic',
      topicTheme: 'Tutor chooses from this board',
    }));
  };

  const selectTopic = (topicId) => {
    const topic = topicOptions.find((item) => item.id === topicId) || topicOptions[0];
    setSettings((current) => ({
      ...current,
      topicId: topic.id,
      topic: topic.label,
      topicTheme: topic.theme,
    }));
  };

  const submitRequest = async (studentAnswer = '', previousResult = result) => {
    if (limitReached || loading) return;
    setLoading(true);
    setError('');
    const requestHistory = [
      ...history,
      ...(previousResult?.replyEnglish ? [{ role: 'tutor', message: previousResult.replyEnglish }] : []),
      ...(studentAnswer ? [{ role: 'student', message: studentAnswer }] : []),
    ].slice(-12);
    try {
      const response = await api.post(aiEndpoint || `/groups/${groupId}/student-tools/ai`, {
        toolId,
        testMode,
        inputs: { ...settings, deviceTimezone: getDeviceTimezone() },
        history: requestHistory,
        answer: studentAnswer,
        previousActivity: previousResult?.activity || {},
      });
      const nextResult = normalizeTutorResult(response.data?.result);
      if (!nextResult) throw new Error('The tutor returned an empty response. Please try again.');
      const nextUsage = response.data?.tutorUsage;
      setHistory(requestHistory);
      setResult(nextResult);
      setAnswer('');
      setOrderedTokens([]);
      setStarted(true);
      if (nextUsage) {
        setUsage(nextUsage);
        onUsageChange(nextUsage);
      }
    } catch (requestError) {
      const nextUsage = requestError.response?.data?.tutorUsage;
      if (nextUsage) {
        setUsage(nextUsage);
        onUsageChange(nextUsage);
      }
      setError(requestError.response?.data?.error || requestError.message || `The ${language} tutor could not respond. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const sendAnswer = () => {
    const finalAnswer = result?.activity?.type === 'word-order'
      ? orderedTokens.map((item) => item.token).join(' ')
      : answer.trim();
    if (!finalAnswer || loading || limitReached) return;
    submitRequest(finalAnswer);
  };

  const chooseToken = (token, index) => {
    if (selectedTokenIndexes.has(index)) return;
    setOrderedTokens((current) => [...current, { token, index }]);
  };

  if (!started) {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-[#0a1022]">
        <header className={`relative isolate overflow-hidden bg-gradient-to-br ${accent} p-6 text-white sm:p-8 lg:min-h-[23rem] lg:p-10`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_88%_20%,rgba(255,255,255,0.16),transparent_30%)]" />
          {heroAvailable ? <img src={heroPath} alt="" onError={() => setHeroAvailable(false)} className="absolute right-0 top-0 hidden h-full w-[48%] object-cover object-center opacity-95 lg:block" /> : null}
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10" />
          <div className="relative max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/25 bg-white/15 text-sm font-black backdrop-blur">{languageCode}</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] backdrop-blur">Interactive GCSE tutor</span>
              <UsagePill usage={usage} testMode={testMode} />
            </div>
            <h3 className="mt-6 text-3xl font-black leading-tight sm:text-5xl">Practise {language}. Understand every correction.</h3>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/85 sm:text-base">Choose your real exam board and focus. Activities stay in {language}, while marking, explanations and improvement advice stay clear in English.</p>
            <div className="mt-6 grid max-w-xl gap-2 sm:grid-cols-3">
              <HeroSignal icon={FiTarget} label="Board aligned" />
              <HeroSignal icon={FiEdit3} label="Visual corrections" />
              <HeroSignal icon={FiTrendingUp} label="Adapts each turn" />
            </div>
          </div>
        </header>

        <div className="space-y-7 p-5 sm:p-7 lg:p-8">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Step 1</p><h4 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Which exam board do you study?</h4></div>
              <p className="hidden text-xs font-bold text-slate-400 sm:block">Not sure? Choose mixed GCSE.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {config.examBoards.map((board) => {
                const selected = settings.examBoard === board.id;
                return (
                  <button key={board.id} type="button" onClick={() => selectBoard(board)} className={`group rounded-2xl border p-4 text-left transition ${selected ? 'border-violet-400 bg-violet-50 shadow-[0_12px_30px_rgba(124,58,237,0.12)] dark:border-violet-400/50 dark:bg-violet-400/10' : 'border-slate-200 bg-slate-50 hover:-translate-y-0.5 hover:border-violet-200 dark:border-white/10 dark:bg-white/[0.035]'}`}>
                    <div className="flex items-center justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${selected ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-200'}`}>{BOARD_BADGES[board.id] || board.label.slice(0, 1)}</span>{selected ? <FiCheckCircle className="text-violet-600 dark:text-violet-300" /> : <FiChevronRight className="text-slate-300 transition group-hover:translate-x-0.5" />}</div>
                    <p className="mt-3 text-sm font-black text-slate-950 dark:text-white">{board.label}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{board.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Step 2</p><h4 className="mt-1 text-xl font-black text-slate-950 dark:text-white">Build today&apos;s practice</h4>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SelectField label="GCSE topic" value={settings.topicId} options={topicOptions.map((topic) => ({ value: topic.id, label: topic.theme ? `${topic.label} — ${topic.theme}` : topic.label }))} onChange={selectTopic} />
              <SelectField label="Grammar or tense" value={settings.grammarFocus} options={config.grammarFocuses} onChange={(value) => setSettings((current) => ({ ...current, grammarFocus: value }))} />
              <SelectField label="Tier" value={settings.tier} options={config.tiers} onChange={(value) => setSettings((current) => ({ ...current, tier: value }))} />
              <SelectField label="Activity style" value={settings.activityPreference} options={config.activityPreferences} onChange={(value) => setSettings((current) => ({ ...current, activityPreference: value }))} />
              <label className="sm:col-span-2"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">How are you feeling about this?</span><input value={settings.confidence} maxLength={160} onChange={(event) => setSettings((current) => ({ ...current, confidence: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/[0.05] dark:text-white" placeholder="For example: I know the basics but mix up past tenses." /></label>
            </div>
          </div>

          {limitReached ? <DailyLimitCard language={language} usage={usage} /> : null}
          {error ? <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p> : null}
          <button type="button" onClick={() => submitRequest('', null)} disabled={loading || limitReached} className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${accent} px-5 py-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45`}>{loading ? <FiLoader className="animate-spin" /> : <FiMessageCircle />} {loading ? 'Preparing your first activity...' : limitReached ? `${language} practice resets tomorrow` : `Start ${language} practice`}</button>
        </div>
      </section>
    );
  }

  const feedback = result?.feedback || {};
  const feedbackAvailable = hasTutorFeedback(feedback);
  const showAnswerArea = result?.activity && !loading && !limitReached;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50/70 shadow-[0_25px_80px_rgba(15,23,42,0.1)] dark:border-white/10 dark:bg-[#080d1d]">
      <header className={`flex flex-col gap-4 bg-gradient-to-r ${accent} p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-xs font-black">{languageCode}</span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/65">{settings.examBoardLabel} · GCSE {language}</p><h3 className="truncate font-black">{settings.topic} · {settings.grammarFocus}</h3></div></div>
        <div className="flex flex-wrap items-center gap-2"><UsagePill usage={usage} testMode={testMode} /><button type="button" onClick={() => { setStarted(false); setResult(null); setHistory([]); setError(''); }} className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black"><FiArrowLeft /> Change focus</button></div>
      </header>

      <div className="grid min-h-[40rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-h-0 flex-col p-4 sm:p-6">
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {history.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'student' ? 'ml-auto rounded-br-md bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200'}`}>{message.message}</div>)}
            {result && (result.replyEnglish || feedbackAvailable) ? (
              <div className="max-w-[96%] space-y-3">
                {result.replyEnglish ? <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200"><p>{result.replyEnglish}</p></div> : null}
                {feedbackAvailable ? <FeedbackPanel feedback={feedback} language={language} /> : null}
              </div>
            ) : null}
            {loading ? <TypingDots language={language} /> : null}
          </div>

          {showAnswerArea ? (
            <ActivityCard result={result} answer={answer} setAnswer={setAnswer} orderedTokens={orderedTokens} setOrderedTokens={setOrderedTokens} selectedTokenIndexes={selectedTokenIndexes} chooseToken={chooseToken} sendAnswer={sendAnswer} loading={loading} />
          ) : null}
          {limitReached && !loading ? <div className="mt-4"><DailyLimitCard language={language} usage={usage} completed /></div> : null}
          {error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p> : null}
        </div>

        <aside className="border-t border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.025] xl:border-l xl:border-t-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Latest response</p>
          <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950"><p className="text-3xl font-black">{result?.score ?? 0}%</p><p className="mt-1 text-[10px] font-bold opacity-65">Practice score, not an official grade</p></div>
          {result?.quickTipEnglish ? <div className="mt-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"><FiShuffle className="text-violet-500" /><h4 className="mt-2 text-sm font-black text-slate-900 dark:text-white">Quick language tip</h4><p className="mt-1 text-xs leading-5 text-slate-500">{result.quickTipEnglish}</p></div> : null}
          <div className="mt-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"><FiBookOpen className="text-cyan-500" /><h4 className="mt-2 text-sm font-black text-slate-900 dark:text-white">Exam skill</h4><p className="mt-1 text-xs font-bold capitalize text-slate-500">{[result?.activity?.examSkill, result?.activity?.difficulty].filter(Boolean).join(' · ') || 'Adaptive practice'}</p>{result?.activity?.skillTag ? <p className="mt-1 text-[10px] leading-4 text-slate-400">{result.activity.skillTag}</p> : null}</div>
          <button type="button" onClick={() => submitRequest('', result)} disabled={loading || limitReached} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300"><FiRefreshCw /> Skip to another activity</button>
        </aside>
      </div>
    </section>
  );
}

function HeroSignal({ icon: Icon, label }) {
  return <span className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-wide backdrop-blur"><Icon /> {label}</span>;
}

function UsagePill({ usage, testMode }) {
  if (testMode) return <span className="rounded-full border border-emerald-200/25 bg-emerald-300/15 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-50">Admin test · no cap</span>;
  return <span className="rounded-full border border-white/20 bg-black/10 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur">{usage.used}/{usage.limit} tutor turns today</span>;
}

function DailyLimitCard({ language, usage, completed = false }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200/70 text-amber-800 dark:bg-amber-300/15 dark:text-amber-200">{completed ? <FiAward /> : <FiAlertCircle />}</span><div><h4 className="text-sm font-black">{completed ? `${language} practice complete for today` : `Daily ${language} limit reached`}</h4><p className="mt-1 text-xs leading-5 opacity-80">You used {usage.limit} tutor turns. Your separate {language} allowance resets on the next day in {usage.timezone || 'your device timezone'}.</p></div></div>
    </div>
  );
}

function FeedbackPanel({ feedback, language }) {
  const corrections = feedback.corrections || [];
  const suggestions = feedback.suggestions || [];
  const positives = feedback.whatWasDoneWellEnglish || [];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><FiCheckCircle className="text-emerald-500" /> Correction feedback in English</p>{feedback.summaryEnglish ? <p className="mt-2 text-sm font-bold leading-6 text-slate-800 dark:text-slate-100">{feedback.summaryEnglish}</p> : null}</div>
      <div className="space-y-4 p-4">
        {positives.length ? <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">What you did well</p><div className="mt-2 flex flex-wrap gap-2">{positives.map((item) => <span key={item} className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200"><FiCheck className="mr-1 inline" />{item}</span>)}</div></div> : null}
        {corrections.length ? <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Corrections</p><div className="mt-2 space-y-2">{corrections.map((correction, index) => <div key={`${correction.original}-${index}`} className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 dark:border-rose-400/15 dark:bg-rose-400/[0.07]"><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"><p className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-rose-700 line-through decoration-2 dark:bg-white/[0.05] dark:text-rose-200">{correction.original}</p><FiArrowRight className="hidden text-slate-300 sm:block" /><p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{correction.corrected}</p></div><div className="mt-2 flex flex-wrap items-start gap-2"><span className="rounded-full bg-rose-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-rose-700 dark:bg-rose-400/15 dark:text-rose-200">{CATEGORY_LABELS[correction.category] || correction.category}</span><p className="flex-1 text-[11px] leading-5 text-slate-600 dark:text-slate-300">{correction.explanationEnglish}</p></div></div>)}</div></div> : null}
        {suggestions.length ? <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">Upgrade your answer</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{suggestions.map((suggestion, index) => <div key={`${suggestion.targetLanguage}-${index}`} className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 dark:border-violet-400/15 dark:bg-violet-400/[0.07]"><p className="text-sm font-black text-violet-900 dark:text-violet-100">{suggestion.targetLanguage}</p><p className="mt-1 text-[10px] font-bold text-violet-600 dark:text-violet-300">{suggestion.englishMeaning}</p><p className="mt-2 text-[10px] leading-4 text-slate-500">{suggestion.whyUsefulEnglish}</p></div>)}</div></div> : null}
        {feedback.modelAnswer ? <div className="rounded-xl bg-slate-950 p-4 text-white dark:bg-white dark:text-slate-950"><p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-55">Model {language} answer</p><p className="mt-2 text-sm font-black leading-6">{feedback.modelAnswer}</p>{feedback.modelAnswerEnglish ? <p className="mt-2 border-t border-white/15 pt-2 text-xs leading-5 opacity-70 dark:border-slate-900/15">{feedback.modelAnswerEnglish}</p> : null}</div> : null}
      </div>
    </div>
  );
}

function ActivityCard({ result, answer, setAnswer, orderedTokens, setOrderedTokens, selectedTokenIndexes, chooseToken, sendAnswer, loading }) {
  const activity = result.activity;
  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-lg dark:border-violet-400/20 dark:bg-[#10172d] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">{activity.type.replace('-', ' ')}</span><span className="text-[10px] font-bold capitalize text-slate-400">{[activity.examSkill, activity.difficulty].filter(Boolean).join(' · ')}</span></div>
      {activity.instructionsEnglish ? <p className="mt-3 text-xs font-bold leading-5 text-slate-500">{activity.instructionsEnglish}</p> : null}<p className="mt-2 text-base font-black leading-6 text-slate-950 dark:text-white">{activity.prompt}</p>
      {activity.focusWords?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{activity.focusWords.map((word) => <span key={word} className="rounded-lg border border-cyan-100 bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700 dark:border-cyan-400/15 dark:bg-cyan-400/10 dark:text-cyan-200">{word}</span>)}</div> : null}
      {activity.type === 'multiple-choice' ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{activity.options.map((option) => <button key={option} type="button" onClick={() => setAnswer(option)} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${answer === option ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-400/15 dark:text-violet-100' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'}`}>{option}</button>)}</div> : null}
      {activity.type === 'word-order' ? <div className="mt-4"><div className="min-h-12 rounded-xl border border-dashed border-violet-300 bg-violet-50/60 p-2.5 dark:border-violet-400/30 dark:bg-violet-400/10">{orderedTokens.map((item, index) => <button key={`${item.index}-${index}`} type="button" onClick={() => setOrderedTokens((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="m-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-black text-white">{item.token}</button>)}</div><div className="mt-2 flex flex-wrap gap-2">{activity.tokens.map((token, index) => <button key={`${token}-${index}`} type="button" disabled={selectedTokenIndexes.has(index)} onClick={() => chooseToken(token, index)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-25 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200">{token}</button>)}</div></div> : null}
      {!['multiple-choice', 'word-order'].includes(activity.type) ? <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendAnswer(); } }} className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/[0.05] dark:text-white" placeholder="Type your answer..." /> : null}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{activity.hintEnglish ? <p className="text-[10px] leading-4 text-slate-500"><strong>Hint in English:</strong> {activity.hintEnglish}</p> : <span /> }<button type="button" onClick={sendAnswer} disabled={loading || (!(answer.trim()) && !orderedTokens.length)} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-35 dark:bg-white dark:text-slate-950"><FiSend /> Check and continue</button></div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  const normalized = (options || []).map((option) => typeof option === 'string' ? { value: option, label: option } : option);
  return <label><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span><div className="relative mt-2"><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-9 text-sm font-bold text-slate-800 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/[0.05] dark:text-white">{normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><FiChevronRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" /></div></label>;
}

export default LanguageTutorTool;
