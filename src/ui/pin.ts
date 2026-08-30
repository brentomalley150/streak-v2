/**
 * The parent PIN gate and setup screens.
 *
 * Deliberately NOT on the daily screen: a kid must reach their own track with
 * no friction. This guards only the screens where money and destructive
 * actions live.
 *
 * The gate is a speed bump for a child, not security — the hash sits in the
 * same localStorage as the data it guards. The copy never claims otherwise.
 */
import type { Store } from '../core/store.js';
import { isValidPin } from '../core/pin.js';
import { el, clear, on } from './dom.js';

function pinField(label: string): { wrap: HTMLElement; input: HTMLInputElement } {
  const input = el('input', {
    class: 'input', type: 'password', inputmode: 'numeric',
    autocomplete: 'off', placeholder: '••••', maxlength: '12',
  }) as HTMLInputElement;
  const wrap = el('label', { class: 'field' }, [el('span', {}, [label]), input]);
  return { wrap, input };
}

/**
 * Ask for the PIN before running `onPass`. Renders over the whole root, so the
 * caller shows its own screen only after a correct entry.
 */
export function renderPinGate(
  root: HTMLElement, store: Store, purpose: string,
  onPass: () => void, onCancel: () => void,
): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });

  const { wrap, input } = pinField('Parent PIN');
  const err = el('p', { class: 'muted', style: 'margin:0 0 var(--s-2);min-height:1.2em' }, ['']);

  const submit = () => {
    if (store.checkParentPin(input.value)) { onPass(); return; }
    err.textContent = 'That PIN did not match. Try again.';
    input.value = '';
    input.focus();
  };

  const go = el('button', { class: 'btn', type: 'button' }, ['Continue']);
  on(go, 'click', submit);
  on(input, 'keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') submit(); });

  const cancel = el('button', { class: 'btn btn--link', type: 'button' }, ['← Not now']);
  on(cancel, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; onCancel(); });

  screen.append(
    el('div', { class: 'eyebrow' }, ['For parents']),
    el('h2', {}, ['Enter your PIN']),
    el('p', {}, [purpose]),
    wrap, err, go, cancel,
  );
  root.append(screen);
  input.focus();
}

/** Set or change the PIN. Requires the old one when one is already set. */
export function renderPinSetup(
  root: HTMLElement, store: Store, done: () => void, onCancel: () => void,
): void {
  clear(root);
  document.documentElement.dataset['surface'] = 'parent';
  const screen = el('div', { class: 'screen' });
  const changing = store.pinIsSet;

  const old = pinField('Current PIN');
  const next = pinField(changing ? 'New PIN (4+ digits)' : 'PIN (4+ digits)');
  const err = el('p', { class: 'muted', style: 'margin:0 0 var(--s-2);min-height:1.2em' }, ['']);

  const save = el('button', { class: 'btn', type: 'button' }, [changing ? 'Change PIN' : 'Set PIN']);
  on(save, 'click', () => {
    if (changing && !store.checkParentPin(old.input.value)) {
      err.textContent = 'That current PIN did not match.';
      return;
    }
    if (!isValidPin(next.input.value)) {
      err.textContent = 'Use at least 4 digits.';
      return;
    }
    store.setParentPin(next.input.value);
    document.documentElement.dataset['surface'] = 'kid';
    done();
  });

  const cancel = el('button', { class: 'btn btn--link', type: 'button' }, ['← Back']);
  on(cancel, 'click', () => { document.documentElement.dataset['surface'] = 'kid'; onCancel(); });

  screen.append(
    el('div', { class: 'eyebrow' }, ['For parents']),
    el('h2', {}, [changing ? 'Change your PIN' : 'Set a parent PIN']),
    el('p', {}, [
      changing
        ? 'You will need this to reach the parent screens.'
        : 'This keeps your kid out of the screens where plans and data live. It is a speed bump, not a lock — anyone who knows the PIN can get in.',
    ]),
    ...(changing ? [old.wrap] : []), next.wrap, err, save, cancel,
  );
  root.append(screen);
  (changing ? old.input : next.input).focus();
}
