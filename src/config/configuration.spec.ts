import { buildConfig } from './configuration';

describe('buildConfig', () => {
  it('applies the documented defaults when nothing is set', () => {
    const config = buildConfig({ AI_PROVIDER: 'mock' });
    expect(config.app.apiPrefix).toBe('api/v1');
    expect(config.recognition.unsureThreshold).toBe(0.5);
    expect(config.storage.allowedImageTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('rejects a non-numeric value for a numeric key', () => {
    expect(() => buildConfig({ AI_PROVIDER: 'mock', PORT: 'abc' })).toThrow('PORT');
  });

  it('requires JWT_SECRET in production', () => {
    expect(() => buildConfig({ AI_PROVIDER: 'mock', NODE_ENV: 'production' })).toThrow('JWT_SECRET');
  });
});
