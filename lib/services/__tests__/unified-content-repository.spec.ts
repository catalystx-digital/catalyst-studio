import { deepMerge } from '../unified-content-repository';

describe('Unified Content Repository - deepMerge', () => {
  it('merges nested objects recursively', () => {
    const base = { a: 1, b: { x: 1, y: 2 } };
    const override = { b: { y: 3, z: 4 }, c: 5 } as any;
    const out = deepMerge(base, override) as any;
    expect(out).toEqual({ a: 1, b: { x: 1, y: 3, z: 4 }, c: 5 });
  });

  it('replaces arrays entirely', () => {
    const base = { items: [1, 2, 3] };
    const override = { items: [9] };
    const out = deepMerge(base, override) as any;
    expect(out).toEqual({ items: [9] });
  });

  it('deletes keys when override has null', () => {
    const base = { a: 1, b: { x: 1, y: 2 } };
    const override = { b: { y: null } } as any;
    const out = deepMerge(base, override) as any;
    expect(out).toEqual({ a: 1, b: { x: 1 } });
  });

  it('override primitive replaces base primitive', () => {
    const base = { a: 1 };
    const override = { a: 2 };
    const out = deepMerge(base, override) as any;
    expect(out).toEqual({ a: 2 });
  });
});

