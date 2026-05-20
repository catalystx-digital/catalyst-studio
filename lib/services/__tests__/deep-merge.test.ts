import { deepMerge } from '../unified-content-repository';

describe('deepMerge (MVP semantics)', () => {
  it('merges nested objects and deletes with null', () => {
    const base = { a: 1, b: { c: 2, d: 3 } };
    const override = { b: { c: 5, d: null }, e: 9 } as any;
    const result = deepMerge(base, override) as any;
    expect(result.a).toBe(1);
    expect(result.b.c).toBe(5);
    expect(result.b.d).toBeUndefined();
    expect(result.e).toBe(9);
  });

  it('replaces arrays entirely', () => {
    const base = { items: [{ id: 1 }, { id: 2 }], x: 1 };
    const override = { items: [{ id: 9 }] } as any;
    const result = deepMerge(base, override) as any;
    expect(result.items).toEqual([{ id: 9 }]);
    expect(result.x).toBe(1);
  });

  it('treats nulls inside arrays as values (no per-element delete)', () => {
    const base = { items: [{ id: 1, label: 'A' }, { id: 2, label: 'B' }], meta: { x: 1 } } as any;
    const override = { items: [null, { id: 3, label: 'C' }] } as any;
    const result = deepMerge(base, override) as any;
    // Entire array replaced; null remains as a literal element in array
    expect(result.items).toEqual([null, { id: 3, label: 'C' }]);
    // Unrelated keys preserved
    expect(result.meta).toEqual({ x: 1 });
  });

  it('primitive override replaces base', () => {
    const base = { a: 1 } as any;
    const override = { a: 2 } as any;
    const result = deepMerge(base, override) as any;
    expect(result.a).toBe(2);
  });
});
