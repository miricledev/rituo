export const getHabitCompletionWindowState = (completionWindow, nowMs = Date.now()) => {
  if (!completionWindow) {
    return {
      status: 'loading',
      canSubmit: false,
      activeWindow: null,
      nextWindow: null
    };
  }

  const windows = completionWindow.windows || [];
  const availableWindows = windows.filter((window) => !window.logged);
  const activeWindow = availableWindows.find((window) => {
    const opensAt = new Date(window.opensAt).getTime();
    const closesAt = new Date(window.closesAt).getTime();
    return Number.isFinite(opensAt) && Number.isFinite(closesAt) && opensAt <= nowMs && nowMs <= closesAt;
  }) || null;
  const nextWindow = availableWindows.find((window) => {
    const opensAt = new Date(window.opensAt).getTime();
    return Number.isFinite(opensAt) && nowMs < opensAt;
  }) || null;

  if (activeWindow) {
    return { status: 'open', canSubmit: true, activeWindow, nextWindow };
  }
  if (nextWindow) {
    return { status: 'upcoming', canSubmit: false, activeWindow: null, nextWindow };
  }
  return {
    status: ['not-scheduled', 'not-applicable'].includes(completionWindow.status)
      ? completionWindow.status
      : 'closed',
    canSubmit: false,
    activeWindow: null,
    nextWindow: null
  };
};
