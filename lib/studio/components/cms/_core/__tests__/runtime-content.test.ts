import { readRuntimeContent } from '../utils';

describe('readRuntimeContent', () => {
  it('returns canonical runtime content objects unchanged', () => {
    const content = { heading: 'Canonical heading' };

    expect(readRuntimeContent(content)).toBe(content);
  });

  it('rejects stringified runtime content instead of parsing it', () => {
    expect(() => readRuntimeContent('{"heading":"Legacy heading"}')).toThrow(
      'CMS runtime content must be canonical object content; string content is not accepted.'
    );
  });
});
