import { describe, it, expect } from 'vitest';
import { hashPin, isValidPin, verifyPin } from './pin.js';
import { Store } from './store.js';
import { KEYS } from './storage.js';

describe('hashPin — must stay byte-identical to v1', () => {
  // Captured by running v1's own hashPin (summerslide/admin.html). If these
  // change, every migrated family is locked out of their settings.
  it.each([
    ['1234', 'h_yjbbf3_4'],
    ['0000', 'h_yjahxh_4'],
    ['9999', 'h_yjhnah_4'],
    ['4321', 'h_yjdnf3_4'],
    ['246810', 'h_zljhcq_6'],
  ])('hashes %s exactly as v1 did', (pin, expected) => {
    expect(hashPin(pin)).toBe(expected);
  });

  it('returns empty for an empty pin, as v1 did', () => {
    expect(hashPin('')).toBe('');
  });
});

describe('isValidPin', () => {
  it('accepts four or more digits, matching v1s rule', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
  });

  it('rejects anything shorter, empty, or not all digits', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('12 34')).toBe(false);
  });
});

describe('verifyPin', () => {
  it('accepts the pin that produced the stored hash', () => {
    expect(verifyPin('1234', hashPin('1234'))).toBe(true);
  });

  it('rejects a wrong pin', () => {
    expect(verifyPin('9999', hashPin('1234'))).toBe(false);
  });

  it('verifies a hash written by v1, not just one we produced', () => {
    expect(verifyPin('1234', 'h_yjbbf3_4')).toBe(true);
  });

  it('never verifies when no pin was set — the gate must not open', () => {
    expect(verifyPin('1234', '')).toBe(false);
    expect(verifyPin('', '')).toBe(false);
  });
});

/** Minimal in-memory Storage so tests need no DOM. */
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

function storeWithKid(): Store {
  const s = new Store(new MemStorage());
  s.init();
  s.addProfile('Declan');
  return s;
}

describe('Store — the parent PIN', () => {
  it('is not set on a fresh family, so nothing is gated', () => {
    expect(storeWithKid().pinIsSet).toBe(false);
  });

  it('sets a valid pin and reports it set', () => {
    const s = storeWithKid();
    expect(s.setParentPin('1234')).toBe(true);
    expect(s.pinIsSet).toBe(true);
    expect(s.checkParentPin('1234')).toBe(true);
    expect(s.checkParentPin('9999')).toBe(false);
  });

  it('refuses an invalid pin rather than half-setting one', () => {
    const s = storeWithKid();
    expect(s.setParentPin('12')).toBe(false);
    expect(s.pinIsSet).toBe(false);
  });

  it('never stores the pin itself', () => {
    const ls = new MemStorage();
    const s = new Store(ls);
    s.init(); s.addProfile('Declan');
    s.setParentPin('4321');

    const dump = JSON.stringify(ls.getItem(KEYS.profiles) ?? '');
    expect(dump).not.toContain('4321');
    expect(dump).toContain('h_yjdnf3_4');
  });

  it('survives a reload', () => {
    const ls = new MemStorage();
    const a = new Store(ls);
    a.init(); a.addProfile('Declan'); a.setParentPin('1234');

    const b = new Store(ls);
    b.init();

    expect(b.pinIsSet).toBe(true);
    expect(b.checkParentPin('1234')).toBe(true);
  });

  it('clears only with the correct pin', () => {
    const s = storeWithKid();
    s.setParentPin('1234');

    expect(s.clearParentPin('9999')).toBe(false);
    expect(s.pinIsSet).toBe(true);

    expect(s.clearParentPin('1234')).toBe(true);
    expect(s.pinIsSet).toBe(false);
  });

  it('is per-kid, since parentAuth lives on the profile', () => {
    const s = storeWithKid();
    s.setParentPin('1234');
    const declan = s.profile!.id;

    s.addProfile('Sophie');
    expect(s.pinIsSet).toBe(false);   // Sophie's profile has no pin yet

    s.switchProfile(declan);
    expect(s.pinIsSet).toBe(true);
  });
});

describe('a migrated v1 family keeps their existing PIN', () => {
  it('accepts the PIN they set in v1, with no reset needed', () => {
    const ls = new MemStorage();
    // v1's own blob shape, carrying a hash v1 itself produced for "1234".
    ls.setItem('declan-dashboard-v2', JSON.stringify({
      player: { name: 'Declan' },
      playerAvatar: '👑',
      preference: 'chess',
      entries: {},
      parentAuth: { setupComplete: true, adminName: 'Kate', adminPinHash: 'h_yjbbf3_4' },
    }));

    const s = new Store(ls);
    s.init();

    expect(s.pinIsSet).toBe(true);
    expect(s.checkParentPin('1234')).toBe(true);
    expect(s.checkParentPin('0000')).toBe(false);
  });
});
