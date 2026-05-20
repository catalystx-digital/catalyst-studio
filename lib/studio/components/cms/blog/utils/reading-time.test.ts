import {
  calculateReadingTime,
  formatReadingTime,
  getReadingTime,
  calculateReadingTimeFromHtml,
  calculateMixedContentReadingTime
} from './reading-time';

describe('Reading Time Utilities', () => {
  describe('calculateReadingTime', () => {
    it('should return 0 for empty text', () => {
      expect(calculateReadingTime('')).toBe(0);
      expect(calculateReadingTime(null as any)).toBe(0);
      expect(calculateReadingTime(undefined as any)).toBe(0);
    });

    it('should calculate 1 minute for short text', () => {
      const shortText = 'Lorem ipsum dolor sit amet.';
      expect(calculateReadingTime(shortText)).toBe(1);
    });

    it('should calculate correct time for 225 words (1 minute)', () => {
      const words = new Array(225).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe(1);
    });

    it('should calculate correct time for 450 words (2 minutes)', () => {
      const words = new Array(450).fill('word').join(' ');
      expect(calculateReadingTime(words)).toBe(2);
    });

    it('should round up for partial minutes', () => {
      const words = new Array(226).fill('word').join(' '); // Slightly over 1 minute
      expect(calculateReadingTime(words)).toBe(2);
    });

    it('should handle text with multiple spaces correctly', () => {
      const text = 'word   word    word     word'; // 4 words
      expect(calculateReadingTime(text)).toBe(1);
    });
  });

  describe('formatReadingTime', () => {
    it('should format less than 1 minute', () => {
      expect(formatReadingTime(0)).toBe('< 1 min read');
      expect(formatReadingTime(-1)).toBe('< 1 min read');
      expect(formatReadingTime(null as any)).toBe('< 1 min read');
    });

    it('should format 1 minute singular', () => {
      expect(formatReadingTime(1)).toBe('1 min read');
    });

    it('should format multiple minutes plural', () => {
      expect(formatReadingTime(2)).toBe('2 min read');
      expect(formatReadingTime(5)).toBe('5 min read');
      expect(formatReadingTime(10)).toBe('10 min read');
    });
  });

  describe('getReadingTime', () => {
    it('should calculate and format in one step', () => {
      const shortText = 'Lorem ipsum dolor sit amet.';
      expect(getReadingTime(shortText)).toBe('1 min read');
    });

    it('should handle long text', () => {
      const words = new Array(900).fill('word').join(' ');
      expect(getReadingTime(words)).toBe('4 min read');
    });

    it('should handle empty text', () => {
      expect(getReadingTime('')).toBe('< 1 min read');
    });
  });

  describe('calculateReadingTimeFromHtml', () => {
    it('should strip HTML tags before calculating', () => {
      const html = '<p>This is <strong>bold</strong> text.</p>';
      expect(calculateReadingTimeFromHtml(html)).toBe(1);
    });

    it('should handle complex HTML', () => {
      const html = `
        <div>
          <h1>Title</h1>
          <p>Paragraph with <a href="#">link</a></p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      `;
      expect(calculateReadingTimeFromHtml(html)).toBe(1);
    });

    it('should handle self-closing tags', () => {
      const html = 'Text with<br/>line break<hr/>and rule';
      expect(calculateReadingTimeFromHtml(html)).toBe(1);
    });

    it('should return 0 for empty HTML', () => {
      expect(calculateReadingTimeFromHtml('')).toBe(0);
      expect(calculateReadingTimeFromHtml('<p></p>')).toBe(0);
    });
  });

  describe('calculateMixedContentReadingTime', () => {
    it('should calculate text only when no images', () => {
      const text = new Array(225).fill('word').join(' ');
      expect(calculateMixedContentReadingTime(text, 0)).toBe(1);
      expect(calculateMixedContentReadingTime(text)).toBe(1); // Default 0 images
    });

    it('should add 12 seconds per image', () => {
      const text = new Array(225).fill('word').join(' '); // 1 minute
      expect(calculateMixedContentReadingTime(text, 1)).toBe(2); // 1 min + 12s = 1.2 min -> 2 min (rounded up)
      expect(calculateMixedContentReadingTime(text, 5)).toBe(2); // 1 min + 60s = 2 min
    });

    it('should round up total time', () => {
      const text = new Array(225).fill('word').join(' '); // 1 minute
      expect(calculateMixedContentReadingTime(text, 6)).toBe(3); // 1 min + 72s = 2.2 min -> 3 min
    });

    it('should handle empty text with images', () => {
      expect(calculateMixedContentReadingTime('', 5)).toBe(1); // 0 min + 60s = 1 min
    });
  });
});