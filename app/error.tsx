"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell">
      <a className="wordmark" href="/">
        daily<span>/</span>
      </a>
      <h1>Couldn’t load Daily.</h1>
      <p className="muted">Check your connection and try again.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
