import { parseScopedCssVariableLines } from '../use-css-variables';
import { filterCmsScopedVariables } from '../cms-token-guardrails';

describe('parseScopedCssVariableLines', () => {
  it('keeps brand accents and fonts while rejecting foundation variables', () => {
    const parsed = parseScopedCssVariableLines(`
      :root {
        --background: 0 0% 100%;
        --foreground: 240 10% 3.9%;
        --primary: 270 70% 45%;
        --primary-foreground: 0 0% 100%;
        --radius: 2rem;
        --font-family: Inter, sans-serif;
        --ds-heading-font: Brand Sans, sans-serif;
      }
    `);

    expect(parsed).toEqual([
      ['--primary', '270 70% 45%'],
      ['--primary-foreground', '0 0% 100%'],
      ['--font-family', 'Inter, sans-serif'],
      ['--ds-heading-font', 'Brand Sans, sans-serif'],
    ]);
  });

  it('filters object maps with the same guardrails', () => {
    expect(filterCmsScopedVariables({
      '--primary': '270 70% 45%',
      '--background': '0 0% 100%',
      '--radius': '2rem',
      '--ds-body-font': 'Inter, sans-serif',
    })).toEqual({
      '--primary': '270 70% 45%',
      '--ds-body-font': 'Inter, sans-serif',
    });
  });
});
