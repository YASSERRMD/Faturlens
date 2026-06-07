import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resolveDeviceProfile, type DeviceProfile } from './profile.ts';

export interface DeviceProfileState {
  profile: DeviceProfile | null;
  loading: boolean;
  error: string | null;
}

const DeviceProfileContext = createContext<DeviceProfileState | null>(null);

export function DeviceProfileProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<DeviceProfileState>({
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    resolveDeviceProfile()
      .then((profile) => {
        if (!cancelled) setState({ profile, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ profile: null, loading: false, error: message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <DeviceProfileContext.Provider value={value}>{children}</DeviceProfileContext.Provider>;
}

/** Access the resolved device profile. Must be used within a provider. */
// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider
export function useDeviceProfile(): DeviceProfileState {
  const ctx = useContext(DeviceProfileContext);
  if (!ctx) {
    throw new Error('useDeviceProfile must be used within a DeviceProfileProvider');
  }
  return ctx;
}
