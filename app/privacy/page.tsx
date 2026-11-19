import Link from "next/link";
export const metadata = { title: "Privacy · Daily/" };
export default function Privacy() {
  return (
    <main className="privacy-page">
      <Link href="/" className="wordmark">
        daily<span>/</span>
      </Link>
      <h1>
        Privacy<span className="heading-period">.</span>
      </h1>
      <p className="muted">Effective November 18, 2026</p>
      <p>
        This policy covers Daily and its browser extension. Daily is an
        invite-only leaderboard that compares daily game results.
      </p>
      <h2>Information we handle</h2>
      <p>
        The extension reads page text and game-generated share text on supported
        websites to identify completed results, scores, dates, puzzle numbers,
        and other puzzle identifiers such as Linkdle’s start and end words. Page
        content is processed locally; only the detected result is sent when you
        click Submit to Daily.
      </p>
      <p>
        Daily stores your email address, display name, account identifier,
        optional profile photo, submitted results and share text, ratings, and
        rating history. If share text includes answers or other game details,
        those are stored with the submission. The extension receives your
        display name and sign-in status to show which account is connected.
      </p>
      <p>
        The extension does not read your browser history or maintain a list of
        visited pages. It checks supported tab URLs to identify games and
        communicate with Daily. It observes game sharing actions, but does not
        record general clicks, mouse movements, keystrokes, or activity on
        unrelated sites. It does not read the clipboard.
      </p>
      <h2>Sign-in and cookies</h2>
      <p>
        Daily uses Supabase for account authentication. Passwords are handled by
        Supabase authentication. The extension does not read passwords or export
        session credentials. It uses a Daily tab, where the browser sends the
        existing session automatically. Necessary cookies keep you signed in and
        protect submissions against forged requests.
      </p>
      <h2>How we use information</h2>
      <p>
        We use information to authenticate members, accept results, match the
        same puzzle, calculate Elo, display the private leaderboard, and keep
        the service secure. We do not sell personal information or use it for
        advertising, profiling, or unrelated purposes.
      </p>
      <h2>Who can see it</h2>
      <p>
        Other authorized leaderboard members can see your display name, photo if
        provided, scores, and ratings. Raw share text is not displayed to other
        members. The operator can access stored information to administer the
        service.
      </p>
      <p>
        Vercel hosts Daily; Supabase provides its database, authentication, and
        photo storage. These providers process information on our behalf.
        Requests also expose ordinary technical information, including IP
        addresses, request times, and browser information, to our infrastructure
        providers, which may retain operational and security logs. The extension
        contains no advertising or analytics SDK.
      </p>
      <p>
        Information may also be disclosed where legally required or necessary to
        investigate abuse and protect the service.
      </p>
      <h2>Retention and your choices</h2>
      <p>
        Account and game records are retained while the service operates to
        preserve leaderboard history. Scores cannot be edited through the app.
        You can request access, correction, or deletion by contacting the
        leaderboard owner. Deletion requests may require identity verification;
        backups may remain until the provider’s retention period ends.
      </p>
      <p>
        You can stop extension access by disabling or uninstalling it, or
        changing its site permissions. This does not delete results already
        submitted. You can also use Daily’s paste form without the extension.
      </p>
      <h2>Security</h2>
      <p>
        Data is transmitted over HTTPS. Private tables are accessed through
        authenticated server operations. No system can guarantee complete
        security.
      </p>
      <h2>Limited use</h2>
      <p>
        Daily’s use and transfer of information follows the Chrome Web Store
        User Data Policy, including its Limited Use requirements. Information is
        used only for the extension’s stated functionality and is not sold, used
        for advertising, or transferred for unrelated purposes.
      </p>
      <h2>Contact and changes</h2>
      <p>
        For privacy requests, contact the leaderboard owner through the person
        who invited you. Updates to this policy will appear here with a revised
        effective date.
      </p>
    </main>
  );
}
