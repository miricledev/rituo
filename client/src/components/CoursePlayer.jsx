import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import InlineToast from './InlineToast';

/** TikTok-style vertical scroll: short videos + quizzes after each. Gen Z friendly. */
const CoursePlayer = ({ groupId, challengeId, course, progress, endDate, joinedAt, onProgress }) => {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [toast, setToast] = useState(null);
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const watchIntervalRef = useRef(null);

  const sections = course?.sections || [];
  const section = sections[currentSectionIndex];
  const items = section?.items || [];
  const item = items[currentItemIndex];

  useEffect(() => {
    const update = () => {
      const end = new Date(endDate);
      const now = new Date();
      const diff = Math.max(0, (end - now) / 1000);
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = Math.floor(diff % 60);
      setTimeLeft({ d, h, m, s });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const recordWatch = useCallback(() => {
    if (!section || watchSeconds < 5) return;
    axios.post(`/groups/${groupId}/challenge/${challengeId}/course/progress`, {
      action: 'watch',
      sectionId: section.id,
      seconds: watchSeconds
    }).then(() => onProgress?.()).catch(() => {});
  }, [groupId, challengeId, section?.id, watchSeconds, onProgress]);

  useEffect(() => {
    if (item?.itemType === 'video' && item?.data?.url) {
      watchIntervalRef.current = setInterval(() => {
        setWatchSeconds(prev => {
          const next = prev + 1;
          if (next % 5 === 0) recordWatch();
          return next;
        });
      }, 1000);
    }
    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    };
  }, [item?.id, item?.itemType, recordWatch]);

  const handleSwipeUp = () => {
    if (item?.itemType === 'quiz' && !quizAnswers[item.id]) return;
    if (currentItemIndex < items.length - 1) {
      if (item?.itemType === 'video') recordWatch();
      setCurrentItemIndex(i => i + 1);
      setWatchSeconds(0);
      setQuizAnswers({});
    } else if (currentSectionIndex < sections.length - 1) {
      if (item?.itemType === 'video') recordWatch();
      setCurrentSectionIndex(i => i + 1);
      setCurrentItemIndex(0);
      setWatchSeconds(0);
      setQuizAnswers({});
    }
  };

  const handleSwipeDown = () => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(i => i - 1);
      setWatchSeconds(0);
    } else if (currentSectionIndex > 0) {
      const prevSec = sections[currentSectionIndex - 1];
      setCurrentSectionIndex(i => i - 1);
      setCurrentItemIndex((prevSec?.items?.length || 1) - 1);
      setWatchSeconds(0);
    }
  };

  const handleQuizSubmit = async (correct, total) => {
    if (!item || item.itemType !== 'quiz') return;
    try {
      await axios.post(`/groups/${groupId}/challenge/${challengeId}/course/progress`, {
        action: 'quiz',
        sectionId: section.id,
        itemId: item.id,
        correct,
        total
      });
      setQuizAnswers({ ...quizAnswers, [item.id]: { correct, total } });
      onProgress?.();
      setTimeout(handleSwipeUp, 600);
    } catch (e) {
      setToast({
        type: 'error',
        title: 'Failed to save quiz result',
        message: e.response?.data?.error || 'Please try again.'
      });
    }
  };

  const getEmbedUrl = (url) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      const id = url.match(/(?:v=|\/)([\w-]{11})(?:\?|$)/)?.[1] || url.split('/').pop();
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (url.includes('vimeo.com')) {
      const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : url;
    }
    return url;
  };

  if (!course) return null;

  const overallProgress = progress?.length
    ? (progress.reduce((a, p) => a + (p.passed ? 1 : 0), 0) / progress.length * 100)
    : 0;

  return (
    <div className="relative flex flex-col h-[calc(100vh-12rem)] max-h-[700px] rounded-2xl overflow-hidden bg-black">
      {toast && (
        <div className="absolute left-4 right-4 top-4 z-20">
          <InlineToast toast={toast} onClose={() => setToast(null)} />
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white">
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg">
            {timeLeft != null && (
              <>
                {String(timeLeft.d).padStart(2, '0')}d {String(timeLeft.h).padStart(2, '0')}h {String(timeLeft.m).padStart(2, '0')}m {String(timeLeft.s).padStart(2, '0')}s
              </>
            )}
          </span>
          <span className="text-sm text-gray-400">left</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{Math.round(overallProgress)}%</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative touch-pan-y"
        onWheel={(e) => { if (e.deltaY > 0) handleSwipeUp(); else handleSwipeDown(); }}
      >
        {item?.itemType === 'video' ? (
          <div className="h-full w-full flex items-center justify-center bg-black">
            <iframe
              ref={videoRef}
              src={getEmbedUrl(item.data?.url)}
              title="Course video"
              className="w-full max-w-md aspect-[9/16] rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : item?.itemType === 'quiz' ? (
          <QuizCard
            item={item}
            onSubmit={handleQuizSubmit}
            answered={quizAnswers[item.id]}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            {items.length === 0 ? 'No content in this section yet.' : 'Loading...'}
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-black/60 text-center text-xs text-gray-500">
        Swipe up for next | Swipe down for previous
      </div>
    </div>
  );
};

const QuizCard = ({ item, onSubmit, answered }) => {
  const [selected, setSelected] = useState(null);

  const questions = item?.data?.questions || [];
  const q = questions[0];
  if (!q) return <div className="p-8 text-white">No questions</div>;

  const handleSubmit = () => {
    if (selected === null) return;
    const correct = selected === q.correctIndex ? 1 : 0;
    onSubmit(correct, 1);
  };

  if (answered) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-green-400 text-xl">Submitted. Swipe up for next.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-purple-900/80 to-black">
      <p className="text-white text-lg font-medium mb-6 text-center">{q.question}</p>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {q.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`px-4 py-3 rounded-xl text-left font-medium transition-all ${
              selected === i
                ? 'bg-pink-500 text-white ring-2 ring-pink-300'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <button
        onClick={handleSubmit}
        disabled={selected === null}
        className="mt-8 px-8 py-3 rounded-full bg-pink-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Submit
      </button>
    </div>
  );
};

export default CoursePlayer;
