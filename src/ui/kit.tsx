import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { goBack } from '../app/router';
import { Icon } from './Icon';

type Variant = 'primary' | 'accent' | 'danger' | 'good' | 'quiet' | 'default';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  variant?: Variant;
  big?: boolean;
  selected?: boolean;
  /** Stack the icon above the label. */
  col?: boolean;
  /** Accessible name for an icon-only button. */
  label?: string;
}

export function Button({ icon, variant = 'default', big, selected, col, label, children, className, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant !== 'default' ? variant : '',
    big ? 'big' : '',
    selected ? 'selected' : '',
    col ? 'col' : '',
    !children ? 'icon-only' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} aria-label={!children ? label : undefined} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="grow">
        <span className="label">{label}</span>
        {help && <span className="help small muted" style={{ display: 'block' }}>{help}</span>}
      </span>
      <span className="state">{checked ? 'On' : 'Off'}</span>
      <span className="switch" />
    </button>
  );
}

export interface SegOption<T> {
  value: T;
  label: string;
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegOption<T>[];
  value: T;
  onChange(v: T): void;
}) {
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={'btn' + (o.value === value ? ' selected' : '')}
            onClick={() => onChange(o.value)}
          >
            {o.value === value && <Icon name="tick" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiChips<T extends string | number>({
  label,
  options,
  values,
  onChange,
  help,
}: {
  label: string;
  options: SegOption<T>[];
  values: readonly T[];
  onChange(v: T[]): void;
  help?: string;
}) {
  const toggle = (v: T) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="field">
      <span>{label}</span>
      {help && <span className="help">{help}</span>}
      <div className="chips">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="chip" aria-pressed={values.includes(o.value)} onClick={() => toggle(o.value)}>
            {values.includes(o.value) && <Icon name="tick" />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Modal({ title, children, actions, wide, onClose }: { title: string; children?: ReactNode; actions?: ReactNode; wide?: boolean; onClose?(): void }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Screen({
  title,
  back,
  actions,
  art,
  children,
}: {
  title: string;
  back?: string | boolean;
  actions?: ReactNode;
  /** Address of a module or activity drawing shown beside the title. Decorative. */
  art?: string;
  children: ReactNode;
}) {
  return (
    <div className="screen">
      <header className="topbar">
        {back !== undefined && back !== false && (
          <Button icon="back" variant="quiet" onClick={() => goBack(typeof back === 'string' ? back : '/')} data-testid="back">
            Back
          </Button>
        )}
        {art && <img className="topbar-art" src={art} alt="" />}
        <h1>{title}</h1>
        {actions}
      </header>
      <main className="page">
        <div className="page-inner">{children}</div>
      </main>
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label ?? 'Progress'}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <span className="help">{help}</span>}
    </label>
  );
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}
