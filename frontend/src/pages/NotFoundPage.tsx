import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="not-found container" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">Page not found</h1>
      <p className="muted">That page doesn't exist. It may have moved, or the link may be mistyped.</p>
      <div className="button-row">
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>
        <Link className="btn btn-secondary" to="/app">
          Open dashboard
        </Link>
      </div>
    </section>
  );
}
