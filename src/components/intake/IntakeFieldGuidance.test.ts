// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { goToIntakeField } from './IntakeFieldGuidance';
const mocks = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('sonner', () => ({ toast: { info: mocks.info } }));
beforeEach(() => { document.body.innerHTML = ''; mocks.info.mockReset(); HTMLElement.prototype.scrollIntoView = vi.fn(); });
describe('intake requirement navigation', () => {
  it('scrolls and focuses the relevant input', () => {
    document.body.innerHTML = '<section id="seller"><input aria-invalid="true"/></section>';
    goToIntakeField('seller');
    expect(document.activeElement).toBe(document.querySelector('input'));
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
  it('explains disabled and unavailable targets instead of silently failing', () => {
    document.body.innerHTML = '<fieldset disabled><input id="seller"/></fieldset>';
    goToIntakeField('seller');
    expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('paused'));
    goToIntakeField('missing');
    expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
  });
});
