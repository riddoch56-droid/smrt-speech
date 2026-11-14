import { useEffect } from 'react';
import { navigate, useRoute } from './router';
import { useApp } from './store';
import { Home } from './Home';
import { ModuleScreen } from './ModuleScreen';
import { SetupScreen } from '../session/SetupScreen';
import { SessionScreen } from '../session/SessionScreen';
import { ResultsScreen } from '../session/ResultsScreen';
import { useSession } from '../session/store';
import { ACTIVITY_IDS, MODULES, type ActivityId, type ModuleId } from '../session/types';
import { PatientsScreen } from '../patients/PatientsScreen';
import { PinGate } from '../patients/PinGate';
import { HistoryScreen } from '../history/HistoryScreen';
import { SessionDetailScreen } from '../history/SessionDetailScreen';
import { ProgressReportScreen } from '../reports/ProgressReportScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { FirstRun } from '../settings/FirstRun';
import { UpdatePrompt } from '../settings/UpdatePrompt';
import { WordManagerScreen } from '../custom/WordManagerScreen';
import { MyWordsScreen } from '../custom/MyWordsScreen';
import { CustomReadingScreen } from '../custom/CustomReadingScreen';
import { ImageCreditsScreen } from '../custom/ImageCreditsScreen';

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, true), [to]);
  return null;
}

function Routes() {
  const route = useRoute();
  const request = useSession((s) => s.request);
  const result = useSession((s) => s.result);
  const [a, b] = route;

  switch (a) {
    case undefined:
      return <Home />;
    case 'module':
      return MODULES.some((m) => m.id === b) ? <ModuleScreen module={b as ModuleId} /> : <Redirect to="/" />;
    case 'setup':
      return ACTIVITY_IDS.includes(b as ActivityId) ? <SetupScreen activity={b as ActivityId} /> : <Redirect to="/" />;
    case 'session':
      return request ? <SessionScreen key={request.nonce} request={request} /> : <Redirect to={result ? '/results' : '/'} />;
    case 'results':
      return result ? <ResultsScreen result={result} /> : <Redirect to="/" />;
    // Everything below shows patient records or settings, so it sits behind the privacy PIN.
    case 'patients':
      return (
        <PinGate>
          <PatientsScreen />
        </PinGate>
      );
    case 'history':
      return <PinGate>{b ? <HistoryScreen patientId={b} /> : <Redirect to="/patients" />}</PinGate>;
    case 'session-detail':
      return <PinGate>{b ? <SessionDetailScreen sessionId={b} /> : <Redirect to="/patients" />}</PinGate>;
    case 'progress-report':
      return <PinGate>{b ? <ProgressReportScreen patientId={b} /> : <Redirect to="/patients" />}</PinGate>;
    case 'settings':
      return (
        <PinGate>
          {b === 'words' ? (
            <WordManagerScreen />
          ) : b === 'my-words' ? (
            <MyWordsScreen />
          ) : b === 'my-reading' ? (
            <CustomReadingScreen />
          ) : b === 'credits' ? (
            <ImageCreditsScreen />
          ) : (
            <SettingsScreen />
          )}
        </PinGate>
      );
    default:
      return <Redirect to="/" />;
  }
}

export function App() {
  const ready = useApp((s) => s.ready);
  const firstRunDone = useApp((s) => s.firstRunDone);
  if (!ready) {
    return (
      <div className="screen" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!firstRunDone) return <FirstRun />;
  return (
    <>
      <Routes />
      <UpdatePrompt />
    </>
  );
}
