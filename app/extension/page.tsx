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
      <ol className="extension-install">
        <li>Unzip the download.</li>
        <li>
          Open <code>chrome://extensions</code> (Edge:{" "}
          <code>edge://extensions</code>) and enable Developer mode.
        </li>
        <li>Choose Load unpacked and select the unzipped folder.</li>
        <li>
          Log in to Daily in the same browser, then refresh your game tabs.
        </li>
      </ol>
      <p>
        Finish a supported game, then click Submit to Daily. If no result
        appears, use the game’s Share button.
      </p>
      <Link href="/" className="text-link">
        Back to leaderboard
      </Link>
    </main>
  );
}
