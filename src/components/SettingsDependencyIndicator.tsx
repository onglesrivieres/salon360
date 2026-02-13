import { AlertCircle, ArrowRight, Link2, AlertTriangle } from 'lucide-react';

interface Dependency {
  key: string;
  type: 'requires' | 'affects' | 'conflicts';
  label: string;
}

interface SettingsDependencyIndicatorProps {
  dependencies: Dependency[];
  allSettings: Map<string, { display_name: string; setting_value: boolean }>;
  isEnabled: boolean;
}

export function SettingsDependencyIndicator({
  dependencies,
  allSettings,
  isEnabled,
}: SettingsDependencyIndicatorProps) {
  if (!dependencies || dependencies.length === 0) {
    return null;
  }

  const requires = dependencies.filter(d => d.type === 'requires');
  const affects = dependencies.filter(d => d.type === 'affects');
  const conflicts = dependencies.filter(d => d.type === 'conflicts');

  const hasUnmetRequirements = requires.some(dep => {
    const depSetting = allSettings.get(dep.key);
    return !depSetting || !depSetting.setting_value;
  });

  if (!isEnabled && (affects.length === 0 && requires.length === 0)) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {requires.length > 0 && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${
          hasUnmetRequirements && isEnabled
            ? 'bg-orange-50 border-orange-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            hasUnmetRequirements && isEnabled ? 'text-orange-600' : 'text-blue-600'
          }`} />
          <div className="flex-1 text-sm">
            <span className={hasUnmetRequirements && isEnabled ? 'text-orange-800' : 'text-blue-800'}>
              {hasUnmetRequirements && isEnabled ? (
                <span className="font-medium">Warning: </span>
              ) : null}
              Requires{' '}
              {requires.map((dep, i) => {
                const depSetting = allSettings.get(dep.key);
                const isMissing = !depSetting || !depSetting.setting_value;
                return (
                  <span key={dep.key}>
                    {i > 0 && (requires.length > 2 ? ', ' : ' and ')}
                    <span className={isMissing && isEnabled ? 'font-medium text-orange-900' : 'font-medium'}>
                      {dep.label || depSetting?.display_name || dep.key}
                    </span>
                    {isMissing && isEnabled && ' (disabled)'}
                  </span>
                );
              })}
              {' '}to be enabled
            </span>
          </div>
        </div>
      )}

      {affects.length > 0 && isEnabled && (
        <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <Link2 className="w-4 h-4 mt-0.5 text-gray-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-gray-700">
            Affects{' '}
            {affects.map((dep, i) => {
              const depSetting = allSettings.get(dep.key);
              return (
                <span key={dep.key}>
                  {i > 0 && (affects.length > 2 ? ', ' : ' and ')}
                  <span className="font-medium">
                    {dep.label || depSetting?.display_name || dep.key}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {conflicts.length > 0 && isEnabled && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-red-800">
            <span className="font-medium">Conflicts with: </span>
            {conflicts.map((dep, i) => {
              const depSetting = allSettings.get(dep.key);
              return (
                <span key={dep.key}>
                  {i > 0 && (conflicts.length > 2 ? ', ' : ' and ')}
                  <span className="font-medium">
                    {dep.label || depSetting?.display_name || dep.key}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingDependencyTree({
  dependencies,
  allSettings,
}: {
  dependencies: Dependency[];
  allSettings: Map<string, { display_name: string; setting_value: boolean }>;
}) {
  if (!dependencies || dependencies.length === 0) {
    return null;
  }

  return (
    <div className="ml-6 mt-2 space-y-2">
      {dependencies.map((dep) => {
        const depSetting = allSettings.get(dep.key);
        if (!depSetting) return null;

        const icon = dep.type === 'requires' ? (
          <AlertCircle className="w-3.5 h-3.5 text-blue-500" />
        ) : dep.type === 'affects' ? (
          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        );

        return (
          <div key={dep.key} className="flex items-center gap-2 text-sm">
            <div className="w-4 border-t border-gray-300"></div>
            {icon}
            <span className={`${
              !depSetting.setting_value ? 'text-gray-500' : 'text-gray-700'
            }`}>
              {dep.label || depSetting.display_name}
              {!depSetting.setting_value && (
                <span className="text-xs text-gray-400 ml-1">(disabled)</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
