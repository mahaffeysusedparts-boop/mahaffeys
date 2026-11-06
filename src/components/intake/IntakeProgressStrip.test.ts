// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { IntakeProgressStrip } from './IntakeProgressStrip';
import { DEFAULT_INTAKE_REQUIREMENTS } from '@/types/intakeRequirements';

it('step links focus existing evidence controls without submitting or clicking them', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const submit = vi.fn();
  const form = document.createElement('form');
  form.addEventListener('submit', submit);
  form.innerHTML = '<button id="collection-handoff" type="submit">Save</button><input id="collection-seller-name"/>';
  const container = document.createElement('div'); form.appendChild(container); document.body.appendChild(form);
  const root = createRoot(container);
  await act(async () => root.render(createElement(IntakeProgressStrip, { input: { collection: true, evidence: { customerName: 'Seller' }, requirements: DEFAULT_INTAKE_REQUIREMENTS, verified: true, identity: false } })));
  const next = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Go to next section'))!;
  await act(async () => next.click());
  expect(document.activeElement?.id).toBe('collection-handoff');
  expect(submit).not.toHaveBeenCalled();
  const seller = container.querySelector('[aria-label="Seller details: needs attention"]') as HTMLButtonElement;
  await act(async () => seller.click());
  expect(document.activeElement?.id).toBe('collection-seller-name');
  expect(submit).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Collection draft evidence');
  await act(async () => root.unmount()); form.remove();
});
