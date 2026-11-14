import { useMemo, useState } from 'react';
import { IMAGE_CREDITS } from '../content';
import type { ImageCredit } from '../content/types';
import { Button, Screen, formatDate } from '../ui/kit';
import './custom.css';

const PAGE_SIZE = 40;

const SOURCE_LABELS: Record<ImageCredit['source'], string> = {
  openverse: 'Openverse',
  'wikimedia-commons': 'Wikimedia Commons',
  generated: 'Generated for SMRT Speech',
  project: 'SMRT Speech project',
};

function licenceOf(c: ImageCredit): string {
  return c.source === 'generated' ? 'Generated' : c.licence || 'Unknown';
}

function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

function ExternalLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label} (opens a web page)
    </a>
  );
}

function dateText(iso: string): string {
  return Number.isNaN(Date.parse(iso)) ? iso : formatDate(iso);
}

export function ImageCreditsScreen() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const summary = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of IMAGE_CREDITS) m.set(licenceOf(c), (m.get(licenceOf(c)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return IMAGE_CREDITS;
    return IMAGE_CREDITS.filter((c) =>
      [c.image, c.author, c.licence, SOURCE_LABELS[c.source], c.prompt ?? '', c.modifications].some((f) => f.toLowerCase().includes(q)),
    );
  }, [search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <Screen title="Image credits" back>
      <div className="stack" data-testid="credits-screen">
        <p className="muted">
          Pictures in SMRT Speech are either openly licensed or generated for the app. The app itself never contacts these web pages;
          links open in your browser only when you press them.
        </p>
        <p className="muted" data-testid="design-credit">
          The interface icons, the SMRT Speech mark and the background artwork are a separate set, made for this app. They are not
          third-party pictures and are not listed below.
        </p>
        <div className="row" aria-label="Pictures by licence">
          <span className="tag">{IMAGE_CREDITS.length} pictures</span>
          {summary.map(([licence, n]) => (
            <span key={licence} className="tag">
              {licence}: {n}
            </span>
          ))}
        </div>
        <label className="field">
          <span>Search credits</span>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            data-testid="credits-search"
          />
        </label>
        {filtered.length === 0 && <p className="muted">{IMAGE_CREDITS.length === 0 ? 'No credits have been recorded yet.' : 'No credits match your search.'}</p>}
        <div className="list">
          {visible.map((c) => (
            <div key={c.image} className="card stack" data-testid={`credit-${c.image}`}>
              <div className="row spread">
                <span className="title">{c.image}</span>
                <span className="tag">{licenceOf(c)}</span>
              </div>
              {c.source === 'generated' ? (
                <>
                  <p>Generated for SMRT Speech</p>
                  {c.prompt && <p className="muted small">Prompt: {c.prompt}</p>}
                </>
              ) : (
                <>
                  <p>
                    {SOURCE_LABELS[c.source]}
                    {c.author ? `, by ${c.author}` : ''}
                  </p>
                  <div className="row">
                    <ExternalLink href={safeUrl(c.sourceUrl)} label="Source page" />
                    <ExternalLink href={safeUrl(c.licenceUrl)} label={`Licence: ${c.licence}`} />
                  </div>
                </>
              )}
              <p className="muted small">
                Retrieved {dateText(c.retrieved)}. Changes made: {c.modifications || 'none recorded'}.
              </p>
              {c.flagged && <p className="small">Note: {c.flagged}</p>}
            </div>
          ))}
        </div>
        {pages > 1 && (
          <div className="row spread">
            <Button icon="back" disabled={current === 0} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span>
              Page {current + 1} of {pages}
            </span>
            <Button icon="next" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        )}
      </div>
    </Screen>
  );
}
