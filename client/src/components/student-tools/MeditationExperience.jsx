import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiClock, FiHeadphones, FiPause, FiPlay, FiRefreshCw, FiVolume2, FiX } from 'react-icons/fi';
import api from '../../services/api';

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export function MeditationPlayer({ session, onClose }) {
  const narrationRef = useRef(null);
  const musicRef = useRef(null);
  const playbackAnchorRef = useRef({ startedAt: 0, offsetSeconds: 0 });
  const [playing, setPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const content = session?.session || {};
  const totalSeconds = Number(content.durationSeconds) || 1;
  const progress = Math.min(1, currentSeconds / totalSeconds);
  const radius = 86;
  const circumference = 2 * Math.PI * radius;
  const currentPhase = useMemo(() => (content.phases || []).find((phase) => currentSeconds >= phase.startSecond && currentSeconds < phase.startSecond + phase.durationSeconds) || content.phases?.[content.phases.length - 1], [content.phases, currentSeconds]);

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = Math.min(0.35, Math.max(0, Number(content.music?.targetVolume) || 0.12));
  }, [content.music?.targetVolume]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = playbackAnchorRef.current.offsetSeconds + ((performance.now() - playbackAnchorRef.current.startedAt) / 1000);
      if (elapsed >= totalSeconds) {
        setCurrentSeconds(totalSeconds);
        setPlaying(false);
        narrationRef.current?.pause();
        musicRef.current?.pause();
        return;
      }
      setCurrentSeconds(elapsed);
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing, totalSeconds]);

  useEffect(() => () => {
    narrationRef.current?.pause();
    musicRef.current?.pause();
  }, []);

  const toggle = async () => {
    if (!narrationRef.current) return;
    if (playing) {
      narrationRef.current.pause();
      musicRef.current?.pause();
      playbackAnchorRef.current.offsetSeconds = currentSeconds;
      setPlaying(false);
      return;
    }
    try {
      if (!Number.isFinite(narrationRef.current.duration) || currentSeconds < narrationRef.current.duration - 0.2) {
        narrationRef.current.currentTime = Math.min(currentSeconds, narrationRef.current.duration || currentSeconds);
        await narrationRef.current.play();
      }
      if (musicRef.current) {
        musicRef.current.currentTime = currentSeconds % Math.max(musicRef.current.duration || totalSeconds, 1);
        await musicRef.current.play().catch(() => null);
      }
      playbackAnchorRef.current = { startedAt: performance.now(), offsetSeconds: currentSeconds };
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const reset = () => {
    narrationRef.current?.pause();
    musicRef.current?.pause();
    if (narrationRef.current) narrationRef.current.currentTime = 0;
    if (musicRef.current) musicRef.current.currentTime = 0;
    setCurrentSeconds(0);
    playbackAnchorRef.current = { startedAt: 0, offsetSeconds: 0 };
    setPlaying(false);
  };

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-[#040817]/95 p-3 text-white backdrop-blur-xl sm:p-6">
      <audio ref={narrationRef} src={session.narrationUrl} preload="metadata" />
      {session.musicUrl ? <audio ref={musicRef} src={session.musicUrl} preload="metadata" loop={content.music?.loop !== false} /> : null}
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
        <section style={{ '--meditation-accent': content.accentColor || '#67e8f9' }} className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#101b3a] via-[#0a1025] to-[#1e1241] shadow-[0_40px_140px_rgba(0,0,0,0.65)]">
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[var(--meditation-accent)]/15 blur-[100px]" />
          <button type="button" onClick={onClose} aria-label="Close meditation" className="absolute right-4 top-4 z-10 rounded-xl border border-white/10 bg-black/20 p-2.5 text-slate-300 hover:bg-white/10"><FiX /></button>
          <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:p-10">
            <div className="flex flex-col items-center text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">IP guided meditation</p>
              <div className="relative mt-6 h-64 w-64 sm:h-80 sm:w-80">
                <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90"><circle cx="100" cy="100" r={radius} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.09)" strokeWidth="7" /><circle cx="100" cy="100" r={radius} fill="none" stroke="var(--meditation-accent)" strokeLinecap="round" strokeWidth="7" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} className="transition-all duration-500" /></svg>
                <div className="absolute inset-0 flex items-center justify-center"><div className={`flex h-36 w-36 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] shadow-[0_0_70px_color-mix(in_srgb,var(--meditation-accent)_26%,transparent)] transition-transform duration-[4000ms] ease-in-out sm:h-44 sm:w-44 ${playing && currentPhase?.circleMode === 'expand' ? 'scale-110' : playing && currentPhase?.circleMode === 'contract' ? 'scale-90' : 'scale-100'}`}><div><p className="text-4xl font-black tabular-nums sm:text-5xl">{formatTime(totalSeconds - currentSeconds)}</p><p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">remaining</p></div></div></div>
              </div>
              <div className="mt-4 flex gap-2"><button type="button" onClick={toggle} className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-black text-slate-950">{playing ? <FiPause /> : <FiPlay />} {playing ? 'Pause' : currentSeconds ? 'Continue' : 'Begin session'}</button><button type="button" onClick={reset} aria-label="Restart" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-slate-300"><FiRefreshCw /></button></div>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] font-bold text-slate-400"><span className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5"><FiHeadphones /> Narration</span>{session.musicUrl ? <span className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5"><FiVolume2 /> {content.music?.title}</span> : null}</div>
            </div>
            <div>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">{content.theme} · {content.difficulty}</span>
              <h2 className="mt-4 text-3xl font-black sm:text-5xl">{content.title}</h2><p className="mt-2 text-lg font-bold text-[var(--meditation-accent)]">{content.subtitle}</p><p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">{content.description}</p>
              {content.focus ? <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] p-3"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">Session focus</p><p className="mt-1 text-sm font-black">{content.focus.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{content.focus.studentOutcome}</p></div> : null}
              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.045] p-5"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Current phase</p><h3 className="mt-2 text-2xl font-black">{currentPhase?.name || 'Settle in'}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{currentPhase?.guidance}</p><div className="mt-4 grid grid-cols-2 gap-2"><InfoChip label="Breathing" value={currentPhase?.breathPattern || 'Natural breathing'} /><InfoChip label="Visual cue" value={currentPhase?.visualCue || 'Steady centre'} /></div></div>
              <div className="mt-5 flex gap-2 overflow-x-auto pb-2">{(content.phases || []).map((phase) => { const active = phase.id === currentPhase?.id; return <div key={phase.id} className={`min-w-[9rem] rounded-xl border p-3 ${active ? 'border-[var(--meditation-accent)] bg-white/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}><p className="text-[9px] font-black uppercase text-slate-500">{formatTime(phase.startSecond)} · {formatTime(phase.durationSeconds)}</p><p className="mt-1 text-xs font-black">{phase.name}</p></div>; })}</div>
              <p className="mt-4 text-[10px] leading-5 text-slate-500">{content.safetyNote}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoChip({ label, value }) {
  return <div className="rounded-xl bg-black/20 p-3"><p className="text-[8px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xs font-bold text-slate-200">{value}</p></div>;
}

export function MeditationLibrary({
  groupId,
  previewSession = null,
  endpoint = '',
  refreshKey = 0,
  eyebrow = 'Guided meditation studio',
  title = 'Reset your state on purpose.',
  description = 'Original school-safe sessions combine guided narration, breathing visuals and optional ambient music.'
}) {
  const libraryEndpoint = endpoint || (groupId ? `/groups/${groupId}/student-tools/meditations` : '');
  const [sessions, setSessions] = useState(previewSession ? [previewSession] : []);
  const [selected, setSelected] = useState(previewSession);
  const [loading, setLoading] = useState(Boolean(libraryEndpoint) && !previewSession);
  const [error, setError] = useState('');

  useEffect(() => {
    if (previewSession && !libraryEndpoint) {
      setSessions([previewSession]);
      setSelected(previewSession);
      setLoading(false);
      return undefined;
    }
    if (!libraryEndpoint) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    api.get(libraryEndpoint).then((response) => {
      if (!active) return;
      const savedSessions = response.data?.sessions || [];
      if (!previewSession) {
        setSessions(savedSessions);
        return;
      }
      setSessions([previewSession, ...savedSessions.filter((item) => (item.id || item.sessionKey) !== (previewSession.id || previewSession.sessionKey))]);
    }).catch((requestError) => { if (active) setError(requestError.response?.data?.error || 'Meditation library is unavailable.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [libraryEndpoint, previewSession, refreshKey]);

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-indigo-200/70 bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 p-5 text-white shadow-[0_28px_90px_rgba(49,46,129,0.22)] sm:p-8">
      <img src="/images/tools/meditation-lounge.webp" alt="" aria-hidden="true" className="pointer-events-none absolute right-0 top-0 hidden h-52 w-[45%] object-cover opacity-20 md:block" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300"><FiHeadphones /> {eyebrow}</p><h3 className="mt-2 text-3xl font-black sm:text-4xl">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></div><span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-slate-300">{sessions.length} sessions</span></div>
      {loading ? <p className="mt-8 animate-pulse text-sm text-slate-400">Loading guided sessions...</p> : null}
      {error ? <p className="mt-6 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs font-bold text-rose-200">{error}</p> : null}
      {!loading && !sessions.length && !error ? <div className="relative mt-7 rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-8 text-center"><img src="/images/empty-states/no-meditations.webp" alt="A peaceful Inner Performance meditation space waiting for its first session" className="mx-auto h-44 w-full max-w-lg rounded-[1.25rem] object-cover" /><h4 className="mt-4 font-black">No sessions published yet</h4><p className="mt-2 text-xs text-slate-400">An admin can generate the first guided session in Feature Lab.</p></div> : null}
      <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sessions.map((item) => <article key={item.id || item.sessionKey} className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 backdrop-blur"><div className="flex items-center justify-between"><span style={{ backgroundColor: item.session?.accentColor || '#67e8f9' }} className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]" /><span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-400"><FiClock /> {formatTime(item.session?.durationSeconds)}</span></div><p className="mt-4 text-[9px] font-black uppercase tracking-[0.14em] text-violet-300">{item.session?.focus?.title || item.session?.theme}</p><h4 className="mt-1 text-xl font-black">{item.session?.title}</h4><p className="mt-1 text-xs font-bold text-cyan-300">{item.session?.subtitle}</p><p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-400">{item.session?.description}</p><button type="button" onClick={() => setSelected(item)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-950"><FiPlay /> Open session</button></article>)}</div>
      {selected ? <MeditationPlayer session={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

export default MeditationLibrary;
