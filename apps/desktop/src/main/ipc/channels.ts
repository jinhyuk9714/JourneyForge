export const IPC_CHANNELS = {
  recordingStart: 'recording:start',
  recordingStatus: 'recording:status',
  recordingStop: 'recording:stop',
  sessionsList: 'sessions:list',
  sessionsGet: 'sessions:get',
  exportsWrite: 'exports:write',
} as const;
