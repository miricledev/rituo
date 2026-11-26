import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity,
  FiAlertCircle,
  FiCheckCircle,
  FiCoffee,
  FiEdit3,
  FiInfo,
  FiPause,
  FiPlay,
  FiRefreshCw,
  FiSettings,
  FiSkipForward,
  FiTarget,
  FiVolume2,
  FiVolumeX,
  FiZap,
} from 'react-icons/fi';

const STORAGE_KEY = 'ip:focus-protocol-settings';
const PRESETS = [
  { id: 'starter', label: 'Start line', focus: 12, rest: 3, longRest: 12, rounds: 4, tag: 'Low resistance', description: 'Short structured rounds when starting feels difficult.' },
  { id: 'research', label: 'Structured study', focus: 24, rest: 6, longRest: 20, rounds: 4, tag: 'Study cycle', description: 'A systematic 24/6 rhythm used in student break research.' },
  { id: 'classic', label: 'Classic Pomodoro', focus: 25, rest: 5, longRest: 15, rounds: 4, tag: 'Balanced', description: 'The familiar rhythm for revision and everyday tasks.' },
  { id: 'extended', label: 'Extended focus', focus: 40, rest: 10, longRest: 20, rounds: 3, tag: 'Fewer switches', description: 'More time to settle into writing or problem solving.' },
  { id: 'deep', label: 'Deep work', focus: 50, rest: 10, longRest: 25, rounds: 3, tag: 'High immersion', description: 'Longer blocks for established concentration.' },
  { id: 'exam', label: 'Exam practice', focus: 60, rest: 15, longRest: 25, rounds: 2, tag: 'Timed practice', description: 'A longer block for essays, papers or mock questions.' },
];

const BREAK_ACTIONS = [
  ['Move', 'Stand, stretch or walk briefly.'],
  ['Reset eyes', 'Look away from the screen and into the distance.'],
  ['Hydrate', 'Get water without opening social media.'],
  ['Return ready', 'Decide the first action of the next round.'],
];

const DEFAULT_CUSTOM = { focus: 30, rest: 5, longRest: 15, rounds: 4 };
const DEFAULT_PREFERENCES = {
  autoStartBreaks: false,
  autoStartFocus: false,
  transitionCue: true,
  backgroundSound: 'silent',
  volume: 24,
};

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function loadStoredSettings() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function phaseLabel(phase) {
  if (phase === 'longBreak') return 'Long recovery';
  if (phase === 'shortBreak') return 'Short recovery';
  return 'Focus';
}

function FocusTimerTool({ compact = false }) {
  const [storedSettings] = useState(loadStoredSettings);
  const initialPreset = PRESETS.find((item) => item.id === storedSettings.presetId) || PRESETS[2];
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [customConfig, setCustomConfig] = useState({ ...DEFAULT_CUSTOM, ...(storedSettings.customConfig || {}) });
  const [preferences, setPreferences] = useState({ ...DEFAULT_PREFERENCES, ...(storedSettings.preferences || {}) });
  const [phase, setPhase] = useState('focus');
  const [remainingSeconds, setRemainingSeconds] = useState(initialPreset.focus * 60);
  const [running, setRunning] = useState(false);
  const [completedFocusRounds, setCompletedFocusRounds] = useState(0);
  const [roundsSinceLongBreak, setRoundsSinceLongBreak] = useState(0);
  const [taskLabel, setTaskLabel] = useState('');
  const [distractionCount, setDistractionCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const deadlineRef = useRef(null);
  const completionLockRef = useRef(false);
  const audioContextRef = useRef(null);
  const ambientRef = useRef(null);

  const preset = useMemo(() => {
    if (presetId === 'custom') {
      return {
        id: 'custom',
        label: 'Custom protocol',
        focus: clampNumber(customConfig.focus, 5, 120, 30),
        rest: clampNumber(customConfig.rest, 1, 30, 5),
        longRest: clampNumber(customConfig.longRest, 5, 45, 15),
        rounds: clampNumber(customConfig.rounds, 1, 8, 4),
        tag: 'Your rhythm',
        description: 'A cycle configured around the task and your current attention.',
      };
    }
    return PRESETS.find((item) => item.id === presetId) || PRESETS[2];
  }, [customConfig, presetId]);

  const durationForPhase = useCallback((targetPhase) => {
    if (targetPhase === 'shortBreak') return preset.rest * 60;
    if (targetPhase === 'longBreak') return preset.longRest * 60;
    return preset.focus * 60;
  }, [preset]);

  const phaseDuration = durationForPhase(phase);
  const progress = Math.max(0, Math.min(1, 1 - (remainingSeconds / Math.max(phaseDuration, 1))));
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const currentRound = Math.min(preset.rounds, roundsSinceLongBreak + (phase === 'focus' ? 1 : 0));

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  }, []);

  const stopAmbient = useCallback(() => {
    const activeAmbient = ambientRef.current;
    if (!activeAmbient) return;
    const now = activeAmbient.context.currentTime;
    activeAmbient.master.gain.cancelScheduledValues(now);
    activeAmbient.master.gain.setValueAtTime(activeAmbient.master.gain.value, now);
    activeAmbient.master.gain.linearRampToValueAtTime(0, now + 0.35);
    window.setTimeout(() => {
      activeAmbient.oscillators.forEach((oscillator) => {
        try { oscillator.stop(); } catch (_error) { return; }
      });
    }, 420);
    ambientRef.current = null;
  }, []);

  const startAmbient = useCallback(() => {
    stopAmbient();
    const context = getAudioContext();
    if (!context) return;
    context.resume().catch(() => {});
    const master = context.createGain();
    const targetVolume = (clampNumber(preferences.volume, 0, 100, 24) / 100) * 0.075;
    master.gain.setValueAtTime(0, context.currentTime);
    master.gain.linearRampToValueAtTime(targetVolume, context.currentTime + 1.2);
    master.connect(context.destination);
    const tones = [
      { frequency: 216, gain: 0.55 },
      { frequency: 432, gain: 0.18 },
    ];
    const oscillators = tones.map((tone) => {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(tone.frequency, context.currentTime);
      toneGain.gain.setValueAtTime(tone.gain, context.currentTime);
      oscillator.connect(toneGain);
      toneGain.connect(master);
      oscillator.start();
      return oscillator;
    });
    ambientRef.current = { context, master, oscillators };
  }, [getAudioContext, preferences.volume, stopAmbient]);

  const playTransitionCue = useCallback(() => {
    if (!preferences.transitionCue) return;
    const context = getAudioContext();
    if (!context) return;
    context.resume().catch(() => {});
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(659.25, context.currentTime + 0.32);
    const cueVolume = (clampNumber(preferences.volume, 0, 100, 24) / 100) * 0.16;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(cueVolume, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.65);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.7);
  }, [getAudioContext, preferences.transitionCue, preferences.volume]);

  const moveToPhase = useCallback((nextPhase, shouldRun = false) => {
    const nextDuration = durationForPhase(nextPhase);
    completionLockRef.current = false;
    deadlineRef.current = shouldRun ? Date.now() + (nextDuration * 1000) : null;
    setPhase(nextPhase);
    setRemainingSeconds(nextDuration);
    setRunning(shouldRun);
  }, [durationForPhase]);

  const completePhase = useCallback(() => {
    playTransitionCue();
    if (phase === 'focus') {
      const nextCompleted = completedFocusRounds + 1;
      const nextCycleCount = roundsSinceLongBreak + 1;
      const needsLongBreak = nextCycleCount >= preset.rounds;
      setCompletedFocusRounds(nextCompleted);
      setRoundsSinceLongBreak(needsLongBreak ? 0 : nextCycleCount);
      moveToPhase(needsLongBreak ? 'longBreak' : 'shortBreak', preferences.autoStartBreaks);
      return;
    }
    moveToPhase('focus', preferences.autoStartFocus);
  }, [completedFocusRounds, moveToPhase, phase, playTransitionCue, preferences.autoStartBreaks, preferences.autoStartFocus, preset.rounds, roundsSinceLongBreak]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ presetId, customConfig, preferences }));
  }, [customConfig, preferences, presetId]);

  useEffect(() => {
    if (running && phase === 'focus' && preferences.backgroundSound === '432') startAmbient();
    else stopAmbient();
    return stopAmbient;
  }, [phase, preferences.backgroundSound, running, startAmbient, stopAmbient]);

  useEffect(() => {
    if (!running) return undefined;
    if (!deadlineRef.current) deadlineRef.current = Date.now() + (remainingSeconds * 1000);
    const tick = () => {
      const nextRemaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0 && !completionLockRef.current) {
        completionLockRef.current = true;
        setRunning(false);
        window.setTimeout(completePhase, 0);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [completePhase, running]);

  useEffect(() => () => {
    stopAmbient();
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
  }, [stopAmbient]);

  const choosePreset = (nextPresetId) => {
    const nextPreset = nextPresetId === 'custom'
      ? { ...DEFAULT_CUSTOM, ...customConfig }
      : PRESETS.find((item) => item.id === nextPresetId) || PRESETS[2];
    setPresetId(nextPresetId);
    setRoundsSinceLongBreak(0);
    setRunning(false);
    setPhase('focus');
    setRemainingSeconds(clampNumber(nextPreset.focus, 5, 120, 25) * 60);
    deadlineRef.current = null;
    completionLockRef.current = false;
  };

  const updateCustomConfig = (field, value) => {
    const ranges = {
      focus: [5, 120, 30],
      rest: [1, 30, 5],
      longRest: [5, 45, 15],
      rounds: [1, 8, 4],
    };
    const [minimum, maximum, fallback] = ranges[field];
    const nextValue = clampNumber(value, minimum, maximum, fallback);
    setCustomConfig((current) => ({ ...current, [field]: nextValue }));
    if (presetId === 'custom' && !running && phase === 'focus' && field === 'focus') setRemainingSeconds(nextValue * 60);
  };

  const toggleRunning = () => {
    if (running) {
      const nextRemaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
      deadlineRef.current = null;
      setRunning(false);
      return;
    }
    const context = getAudioContext();
    if (context && (preferences.transitionCue || preferences.backgroundSound === '432')) context.resume().catch(() => {});
    completionLockRef.current = false;
    deadlineRef.current = Date.now() + (remainingSeconds * 1000);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    setPhase('focus');
    setRemainingSeconds(preset.focus * 60);
    setRoundsSinceLongBreak(0);
    setDistractionCount(0);
    deadlineRef.current = null;
    completionLockRef.current = false;
  };

  const skipPhase = () => {
    setRunning(false);
    if (phase === 'focus') moveToPhase('shortBreak', false);
    else moveToPhase('focus', false);
  };

  const updatePreference = (field, value) => setPreferences((current) => ({ ...current, [field]: value }));

  return (
    <section className={`relative overflow-hidden rounded-[2rem] border border-cyan-200/70 bg-gradient-to-br from-slate-950 via-[#101d3b] to-violet-950 text-white shadow-[0_28px_90px_rgba(8,47,73,0.24)] ${compact ? 'p-5' : 'p-5 sm:p-8'}`}>
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
      <div className="relative space-y-6">
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-center">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300"><FiZap /> Focus protocol</p>
            <h3 className="mt-2 text-2xl font-black sm:text-4xl">One task. One clear finish line.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Choose a rhythm that fits the task, define what finished looks like, then protect the block until the circle closes.</p>

            <label className="mt-5 block max-w-2xl">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400"><FiEdit3 /> Focus intention</span>
              <input value={taskLabel} onChange={(event) => setTaskLabel(event.target.value)} maxLength={120} placeholder="What exactly will you finish in this round?" className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300" />
            </label>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PRESETS.map((item) => (
                <button key={item.id} type="button" onClick={() => choosePreset(item.id)} className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${presetId === item.id ? 'border-cyan-300 bg-cyan-300/15 shadow-[0_12px_28px_rgba(34,211,238,0.1)]' : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.09]'}`}>
                  <div className="flex items-start justify-between gap-2"><p className="text-xs font-black">{item.label}</p><span className="rounded-full bg-white/[0.07] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-400">{item.tag}</span></div>
                  <p className="mt-2 text-[10px] font-bold text-cyan-200">{item.focus}m focus · {item.rest}m break</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">{item.description}</p>
                </button>
              ))}
              <button type="button" onClick={() => { choosePreset('custom'); setShowSettings(true); }} className={`rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${presetId === 'custom' ? 'border-violet-300 bg-violet-300/15' : 'border-dashed border-white/15 bg-white/[0.025] hover:bg-white/[0.07]'}`}>
                <div className="flex items-start justify-between gap-2"><p className="text-xs font-black">Custom protocol</p><FiSettings className="text-violet-300" /></div>
                <p className="mt-2 text-[10px] font-bold text-violet-200">{customConfig.focus}m · {customConfig.rest}m · {customConfig.longRest}m long</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">Set your own focus, recovery and round pattern.</p>
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-300">{completedFocusRounds} focus rounds complete</span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-300">Cycle round {Math.max(1, currentRound)} of {preset.rounds}</span>
              <button type="button" onClick={() => setDistractionCount((count) => count + 1)} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">Distraction noted · {distractionCount}</button>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="relative h-52 w-52 sm:h-64 sm:w-64">
              <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
                <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="8" />
                <circle cx="90" cy="90" r={radius} fill="none" stroke={phase === 'focus' ? '#67e8f9' : phase === 'longBreak' ? '#fcd34d' : '#a7f3d0'} strokeLinecap="round" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                {phase === 'focus' ? <FiTarget className="text-cyan-300" /> : <FiCoffee className={phase === 'longBreak' ? 'text-amber-300' : 'text-emerald-300'} />}
                <p className="mt-2 text-4xl font-black tabular-nums sm:text-5xl">{formatSeconds(remainingSeconds)}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{phaseLabel(phase)}</p>
                {taskLabel && phase === 'focus' ? <p className="mt-2 max-w-40 truncate text-[10px] font-bold text-cyan-100">{taskLabel}</p> : null}
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-slate-400">Next: {phase === 'focus' ? `${roundsSinceLongBreak + 1 >= preset.rounds ? preset.longRest : preset.rest}m recovery` : `${preset.focus}m focus`}</p>
            <div className="mt-4 grid w-full max-w-sm grid-cols-[1fr_auto_auto] gap-2">
              <button type="button" onClick={toggleRunning} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5">
                {running ? <FiPause /> : <FiPlay />} {running ? 'Pause' : phase === 'focus' ? 'Start focus' : 'Start break'}
              </button>
              <button type="button" onClick={skipPhase} aria-label="Skip phase" title="Skip phase" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-slate-300 hover:bg-white/[0.1]"><FiSkipForward /></button>
              <button type="button" onClick={reset} aria-label="Reset timer" title="Reset timer" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-slate-300 hover:bg-white/[0.1]"><FiRefreshCw /></button>
            </div>
            <button type="button" onClick={() => setShowSettings((value) => !value)} className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 hover:bg-white/[0.08]"><FiSettings /> {showSettings ? 'Hide settings' : 'Timer and sound settings'}</button>
          </div>
        </div>

        {showSettings ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-black/15 p-4 backdrop-blur sm:p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Custom timing</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberSetting label="Focus minutes" value={customConfig.focus} min={5} max={120} onChange={(value) => updateCustomConfig('focus', value)} />
                <NumberSetting label="Short break" value={customConfig.rest} min={1} max={30} onChange={(value) => updateCustomConfig('rest', value)} />
                <NumberSetting label="Long break" value={customConfig.longRest} min={5} max={45} onChange={(value) => updateCustomConfig('longRest', value)} />
                <NumberSetting label="Rounds per cycle" value={customConfig.rounds} min={1} max={8} onChange={(value) => updateCustomConfig('rounds', value)} />
              </div>
              <button type="button" onClick={() => choosePreset('custom')} className="mt-3 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-black text-white">Use custom protocol</button>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Phase automation</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ToggleSetting label="Automatically start breaks" detail="Recovery begins when focus ends." checked={preferences.autoStartBreaks} onChange={(checked) => updatePreference('autoStartBreaks', checked)} />
                <ToggleSetting label="Automatically restart focus" detail="Only use this if breaks do not overrun." checked={preferences.autoStartFocus} onChange={(checked) => updatePreference('autoStartFocus', checked)} />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">Sound environment</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <SoundChoice icon={FiVolumeX} title="Silent focus" detail="Only the optional transition cue plays." selected={preferences.backgroundSound === 'silent'} onSelect={() => updatePreference('backgroundSound', 'silent')} />
                <SoundChoice icon={FiVolume2} title="432 Hz ambient" detail="A gentle browser-generated tonal bed during focus." selected={preferences.backgroundSound === '432'} onSelect={() => updatePreference('backgroundSound', '432')} />
              </div>
              <ToggleSetting className="mt-2" label="Transition cue" detail="Play a short tone when a phase ends." checked={preferences.transitionCue} onChange={(checked) => updatePreference('transitionCue', checked)} />
              <label className="mt-3 block rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <span className="flex items-center justify-between text-xs font-black text-white"><span>Audio volume</span><span className="text-cyan-200">{preferences.volume}%</span></span>
                <input type="range" min="0" max="60" value={preferences.volume} onChange={(event) => updatePreference('volume', Number(event.target.value))} className="mt-3 w-full accent-cyan-300" />
              </label>
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] p-3 text-[10px] leading-5 text-amber-100"><FiAlertCircle className="mt-0.5 shrink-0" />432 Hz is offered as a listening preference, not as a proven concentration treatment. Keep audio comfortable and stop it if it becomes distracting.</p>
            </div>
          </div>
        ) : null}

        {!compact ? (
          <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300"><FiInfo /> Why several protocols?</p>
              <h4 className="mt-2 text-lg font-black">Structured breaks help, but the task decides the rhythm.</h4>
              <p className="mt-2 text-xs leading-5 text-slate-400">Scheduled breaks can reduce fatigue and distraction, but research does not show one interval as universally best. Start shorter when motivation is low, use longer blocks once concentration is stable, and take enough recovery after demanding work.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <ResearchSignal icon={FiZap} title="Starting difficult?" detail="Try 12/3 or 24/6." />
                <ResearchSignal icon={FiTarget} title="Already focused?" detail="Try 40/10 or 50/10." />
                <ResearchSignal icon={FiCheckCircle} title="Timed output?" detail="Match the real task length." />
              </div>
            </div>
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300"><FiActivity /> Recovery menu</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{BREAK_ACTIONS.map(([title, detail]) => <div key={title} className="rounded-xl border border-white/10 bg-black/10 p-3"><p className="text-xs font-black text-white">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{detail}</p></div>)}</div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function NumberSetting({ label, value, min, max, onChange }) {
  return <label><span className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</span><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm font-black text-white outline-none focus:border-violet-300" /></label>;
}

function ToggleSetting({ label, detail, checked, onChange, className = '' }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 ${className}`}>
      <span><span className="block text-xs font-black text-white">{label}</span><span className="mt-1 block text-[10px] leading-4 text-slate-400">{detail}</span></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 shrink-0 accent-cyan-300" />
    </label>
  );
}

function SoundChoice({ icon: Icon, title, detail, selected, onSelect }) {
  return <button type="button" onClick={onSelect} className={`rounded-xl border p-3 text-left transition ${selected ? 'border-amber-300 bg-amber-300/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}><div className="flex items-center justify-between"><Icon className={selected ? 'text-amber-300' : 'text-slate-400'} />{selected ? <FiCheckCircle className="text-amber-300" /> : null}</div><p className="mt-2 text-xs font-black text-white">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{detail}</p></button>;
}

function ResearchSignal({ icon: Icon, title, detail }) {
  return <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/[0.05] p-3"><Icon className="text-cyan-300" /><p className="mt-2 text-xs font-black text-white">{title}</p><p className="mt-1 text-[10px] text-slate-400">{detail}</p></div>;
}

export default FocusTimerTool;
