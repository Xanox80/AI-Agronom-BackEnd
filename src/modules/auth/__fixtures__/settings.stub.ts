import { AuthSettings } from '../auth.settings';

export function settingsStub(overrides: Partial<Record<keyof AuthSettings, unknown>> = {}): AuthSettings {
  return {
    auth: {
      jwtSecret: 'test-secret', jwtExpiresIn: '15m', refreshTokenExpiresDays: 30, bcryptRounds: 4,
      loginMaxAttempts: 3, loginWindowSeconds: 60,
      trustWeights: { expert: 3, chief: 2, scout: 1, mechanic: 0.5 }, expertConsensusMinWeight: 3,
    },
    apiPrefix: 'api/v1', production: false, seedDemoUsers: true, demoPassword: 'demo-pass-1', demoFarmName: 'Test Farm',
    defaultRegion: 'UA-DEFAULT', safetyBuffers: { waterBufferM: 50, apiaryBufferM: 4000, settlementBufferM: 300 },
    ...overrides,
  } as unknown as AuthSettings;
}
