import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('has expected globals', () => {
    expect(typeof process).toBe('object');
  });
});
