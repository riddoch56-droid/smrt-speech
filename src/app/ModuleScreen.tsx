import { activitiesFor, MODULES, type ModuleId } from '../session/types';
import { ACTIVITY_ART, asset, MODULE_ART } from '../ui/assets';
import { Icon } from '../ui/Icon';
import { Screen } from '../ui/kit';
import { navigate } from './router';

export function ModuleScreen({ module }: { module: ModuleId }) {
  const def = MODULES.find((m) => m.id === module)!;
  const activities = activitiesFor(module);
  return (
    <Screen title={def.title} back="/" art={asset(MODULE_ART[module])}>
      <p className="muted">
        {def.blurb}. Activities are listed from easiest to hardest.
      </p>
      <div className="activity-grid" data-module={module}>
        {activities.map((a, i) => (
          <button type="button" key={a.id} className="activity-card" onClick={() => navigate(`/setup/${a.id}`)} data-testid={`activity-${a.id}`}>
            <span className="art">
              <img src={asset(ACTIVITY_ART[a.id])} alt="" />
            </span>
            <span className="grow">
              <span className="step" style={{ display: 'block' }}>
                Step {i + 1} of {activities.length}
              </span>
              <span className="title" style={{ display: 'block' }}>
                {a.title}
              </span>
              <span className="muted" style={{ display: 'block' }}>
                {a.blurb}
              </span>
            </span>
            <Icon name="next" size={32} />
          </button>
        ))}
      </div>
    </Screen>
  );
}
