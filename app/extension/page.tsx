import Link from "next/link";
export default function Extension() {
  return (
    <main className="auth-shell">
      <Link href="/" className="wordmark">
        daily<span>/</span>
      </Link>
      <h1>
        Extension<span>.</span>
      </h1>
      <p>
        <a className="text-link" href="/downloads/daily-extension.zip" download>
          Download extension
        </a>
      </p>
      <ol>
        <li>Unzip the download.</li>
        <li>Open chrome://extensions and enable Developer mode.</li>
        <li>Choose Load unpacked and select the unzipped folder.</li>
        <li>Log in to Daily in the same browser.</li>
      </ol>
      <p>
        Finish a supported game, then click Submit to Daily. If no result
        appears, use the game’s Share button.
      </p>
      <Link href="/login" className="text-link">
        Log in
      </Link>
    </main>
  );
}
