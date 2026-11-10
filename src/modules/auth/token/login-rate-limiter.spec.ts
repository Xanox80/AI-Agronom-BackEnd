import { settingsStub } from '../__fixtures__/settings.stub';
import { LoginRateLimiter } from './login-rate-limiter';

describe('LoginRateLimiter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const failTimes = (limiter: LoginRateLimiter, n: number) => {
    for (let i = 0; i < n; i++) limiter.recordFailure('k');
  };

  it('allows attempts below the limit', () => {
    const limiter = new LoginRateLimiter(settingsStub());
    failTimes(limiter, 2);
    expect(() => limiter.assertAllowed('k')).not.toThrow();
  });

  it('blocks once the failure limit is reached', () => {
    const limiter = new LoginRateLimiter(settingsStub());
    failTimes(limiter, 3);
    expect(() => limiter.assertAllowed('k')).toThrow('Too many login attempts');
  });

  it('allows again after the window passes', () => {
    const limiter = new LoginRateLimiter(settingsStub());
    failTimes(limiter, 3);
    jest.advanceTimersByTime(61_000);
    expect(() => limiter.assertAllowed('k')).not.toThrow();
  });

  it('clears failures on reset', () => {
    const limiter = new LoginRateLimiter(settingsStub());
    failTimes(limiter, 3);
    limiter.reset('k');
    expect(() => limiter.assertAllowed('k')).not.toThrow();
  });

  it('counts keys independently', () => {
    const limiter = new LoginRateLimiter(settingsStub());
    failTimes(limiter, 3);
    expect(() => limiter.assertAllowed('other')).not.toThrow();
  });
});
