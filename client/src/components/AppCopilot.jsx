import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const getPageName = (pathname) => {
  if (pathname.startsWith('/teacher-desk')) return 'teacher-desk';
  if (pathname.startsWith('/groups/')) return 'group-detail';
  if (pathname.startsWith('/groups')) return 'groups';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'app';
};

const inferGroupId = (pathname) => {
  const groupMatch = pathname.match(/^\/groups\/([^/?#]+)/);
  if (groupMatch?.[1]) return groupMatch[1];
  return localStorage.getItem('teacher-desk-group') || '';
};

const fallbackConfigs = {
  admin: {
    role: 'admin',
    assistantName: 'Operations Copilot',
    audienceLabel: 'Administrator support',
    toneLabel: 'Strategic, direct, and concise',
    description: 'School setup, account provisioning, operational risk, and clear next actions.',
    starterPrompts: [
      'How do I add a school and provision its accounts?',
      'How do I bulk import students and download their logins?',
      'Which school operations need attention today?'
    ]
  },
  teacher: {
    role: 'teacher',
    assistantName: 'Teaching Copilot',
    audienceLabel: 'Teacher support',
    toneLabel: 'Calm, practical, and colleague-like',
    description: 'Today’s classes, student attention, registers, homework, and manageable next actions.',
    starterPrompts: [
      'What do I need to complete before my next class?',
      'Which students need my attention today?',
      'How do I record behaviour and follow it up?'
    ]
  },
  student: {
    role: 'student',
    assistantName: 'Performance Coach',
    audienceLabel: 'Student support',
    toneLabel: 'Positive, simple, and encouraging',
    description: 'Your habits, daily plan, recovery steps, and one achievable action at a time.',
    starterPrompts: [
      'What should I focus on today?',
      'Help me plan my habits around school.',
      'How can I recover if I missed a habit?'
    ]
  }
};

const roleStyles = {
  admin: {
    trigger: 'from-violet-500 to-cyan-400',
    accent: 'text-violet-300',
    chip: 'border-violet-400/25 bg-violet-400/10 text-violet-100'
  },
  teacher: {
    trigger: 'from-blue-500 to-cyan-400',
    accent: 'text-cyan-300',
    chip: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
  },
  student: {
    trigger: 'from-emerald-400 to-cyan-400',
    accent: 'text-emerald-300',
    chip: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
  }
};

export default function AppCopilot() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pageName = getPageName(location.pathname);
  const accountRole = currentUser?.accountRole || 'student';
  const fallbackConfig = fallbackConfigs[accountRole] || fallbackConfigs.student;
  const style = roleStyles[accountRole] || roleStyles.student;
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [assistantConfig, setAssistantConfig] = useState(fallbackConfig);
  const groupId = useMemo(() => inferGroupId(location.pathname), [location.pathname]);

  useEffect(() => {
    let active = true;
    setAssistantConfig(fallbackConfig);
    api.get('/groups/ai-assistant/config', { params: { page: pageName } })
      .then((response) => {
        if (active && response.data?.config) setAssistantConfig(response.data.config);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [accountRole, pageName]);

  const submitPrompt = async (value) => {
    const message = value.trim();
    if (!message || loading) return;
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text: message }]);
    setPrompt('');
    try {
      const response = await api.post('/groups/ai-assistant', {
        message,
        page: pageName,
        pathname: location.pathname,
        groupId,
        date: new Date().toISOString().slice(0, 10)
      });
      if (response.data?.assistant) setAssistantConfig(response.data.assistant);
      setMessages((prev) => [...prev, { role: 'assistant', payload: response.data?.response || null }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          payload: {
            answer: error.response?.data?.error || 'The AI assistant could not respond right now.',
            focusArea: 'Unavailable',
            nextActions: [],
            quickReplies: []
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-5 right-5 z-40 rounded-full bg-gradient-to-r ${style.trigger} px-4 py-3 text-sm font-bold text-slate-950 shadow-xl transition hover:-translate-y-0.5`}
      >
        {assistantConfig.assistantName}
      </button>

      {open ? (
        <div className="fixed bottom-24 right-5 z-40 w-[min(92vw,440px)] rounded-3xl border border-white/10 bg-[#0b1022]/95 p-4 text-white shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={`text-xs font-semibold uppercase tracking-[0.22em] ${style.accent}`}>{assistantConfig.audienceLabel}</div>
              <div className="mt-1 text-lg font-bold">{assistantConfig.assistantName}</div>
              <div className="mt-1 text-sm leading-5 text-slate-400">{assistantConfig.description}</div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{assistantConfig.toneLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Frequently asked</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(assistantConfig.starterPrompts || fallbackConfig.starterPrompts).map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => submitPrompt(starter)}
                disabled={loading}
                className={`rounded-full border px-3 py-2 text-xs font-medium transition hover:brightness-125 disabled:opacity-60 ${style.chip}`}
              >
                {starter}
              </button>
            ))}
          </div>

          <div className="mt-4 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
            {!messages.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-400">
                Responses use your account role, current route, and permitted school context. Suggested actions are filtered to pages your role can access.
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={message.role === 'user'
                  ? `ml-8 rounded-2xl bg-gradient-to-r ${style.trigger} px-4 py-3 text-sm font-medium text-slate-950`
                  : 'mr-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200'}
              >
                {message.role === 'user' ? (
                  message.text
                ) : (
                  <div className="space-y-3">
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${style.accent}`}>
                      {message.payload?.focusArea || 'Rituo Copilot'}
                    </div>
                    <div>{message.payload?.answer}</div>
                    {(message.payload?.nextActions || []).map((action, actionIndex) => (
                      <div key={`${action.title}-${actionIndex}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                        <div className="font-semibold text-white">{action.title}</div>
                        {action.why ? <div className="mt-1 text-xs text-slate-400">{action.why}</div> : null}
                        {action.link?.route ? (
                          <button
                            type="button"
                            onClick={() => navigate(action.link.route)}
                            className={`mt-3 rounded-full bg-gradient-to-r ${style.trigger} px-3 py-1.5 text-xs font-bold text-slate-950`}
                          >
                            {action.link.label || 'Open'}
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {(message.payload?.quickReplies || []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {message.payload.quickReplies.map((reply) => (
                          <button
                            key={reply}
                            type="button"
                            onClick={() => submitPrompt(reply)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${style.chip}`}
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt(prompt);
            }}
            className="mt-4 space-y-3"
          >
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={`Ask ${assistantConfig.assistantName}...`}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                {groupId ? `Context: ${groupId}` : 'General app help'}
              </div>
              <button
                type="submit"
                disabled={loading || !prompt.trim()}
                className={`rounded-full bg-gradient-to-r ${style.trigger} px-4 py-2 text-sm font-bold text-slate-950 transition disabled:opacity-60`}
              >
                {loading ? 'Thinking...' : 'Ask AI'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
