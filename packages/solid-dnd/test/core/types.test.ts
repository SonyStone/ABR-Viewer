import { createItemId, Rect, Vec2 } from 'src/core/types';
import { describe, expect, it } from 'vitest';

describe('core types', () => {
  describe('ItemId', () => {
    it('creates a branded string', () => {
      const id = createItemId('test-1');
      expect(id).toBe('test-1');
      // The brand exists at the type level only — at runtime it's just a string
      expect(typeof id).toBe('string');
    });
  });

  describe('Vec2', () => {
    it('has a Zero constant', () => {
      expect(Vec2.Zero).toEqual({ x: 0, y: 0 });
    });

    it('creates a vector with of()', () => {
      const v = Vec2.of(10, 20);
      expect(v).toEqual({ x: 10, y: 20 });
    });
  });

  describe('Rect', () => {
    it('has a Zero constant', () => {
      expect(Rect.Zero).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('creates a rect with of()', () => {
      const r = Rect.of(5, 10, 100, 50);
      expect(r).toEqual({ x: 5, y: 10, width: 100, height: 50 });
    });
  });
});
