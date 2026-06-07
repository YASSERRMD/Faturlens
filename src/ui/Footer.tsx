import { APP_VERSION, MODEL_ID, PROMPT_VERSIONS } from '../lib/version.ts';

/** App footer: version, model id, and prompt versions. */
export function Footer(): React.JSX.Element {
  return (
    <footer
      style={{
        marginTop: '2rem',
        paddingTop: '1rem',
        borderTop: '1px solid var(--fl-border, #d8d8d8)',
        fontSize: '0.75rem',
        color: 'var(--fl-text-muted, #6a6a6a)',
        textAlign: 'center',
      }}
    >
      Faturlens v{APP_VERSION} · {MODEL_ID} · prompts {PROMPT_VERSIONS.pass1}/
      {PROMPT_VERSIONS.pass2}
    </footer>
  );
}
