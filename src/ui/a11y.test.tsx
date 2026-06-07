import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { Welcome } from './Welcome.tsx';
import { FailureCard } from './Welcome.tsx';

async function seriousViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    // Color contrast cannot be computed reliably in jsdom; skip it here.
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => v.id);
}

describe('accessibility', () => {
  it('Welcome has no serious axe violations', async () => {
    const { container } = render(
      <Welcome onUpload={() => undefined} onLoadDemos={() => undefined} />,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('FailureCard has no serious axe violations', async () => {
    const { container } = render(
      <FailureCard
        title="Storage denied"
        message="Please allow storage."
        onRetry={() => undefined}
      />,
    );
    expect(await seriousViolations(container)).toEqual([]);
  });
});
