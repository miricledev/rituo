export const getDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
  } catch (_error) {
    return 'Europe/London';
  }
};

export const syncDeviceTimezone = async (axios, endpoint, settings = {}) => {
  const deviceTimezone = getDeviceTimezone();
  if (settings.timezone === deviceTimezone) return settings;
  const response = await axios.put(endpoint, { timezone: deviceTimezone });
  return response.data?.settings || { ...settings, timezone: deviceTimezone };
};
