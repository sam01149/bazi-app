import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILES_KEY      = '@bazi_profiles';
const ACTIVE_IDX_KEY    = '@bazi_active_profile_idx';
// Legacy keys — migrated on first load
const LEGACY_CHART_KEY  = '@bazi_chart_id';
const LEGACY_TZ_KEY     = '@bazi_timezone';

export interface StoredProfile {
  chartId: string;
  timezone: string;
  nickname: string;
  createdAt: string;
}

interface ChartContextValue {
  chartId: string | null;
  timezone: string;
  setChart: (id: string, tz: string) => Promise<void>;
  clearChart: () => Promise<void>;
  loading: boolean;
  // Multi-profile
  profiles: StoredProfile[];
  activeProfileIdx: number;
  switchProfile: (idx: number) => Promise<void>;
  addNewProfile: () => Promise<void>;
  removeActiveProfile: () => Promise<void>;
  renameProfile: (idx: number, nickname: string) => Promise<void>;
}

const ChartContext = createContext<ChartContextValue>({
  chartId: null,
  timezone: 'Asia/Jakarta',
  setChart: async () => {},
  clearChart: async () => {},
  loading: true,
  profiles: [],
  activeProfileIdx: -1,
  switchProfile: async () => {},
  addNewProfile: async () => {},
  removeActiveProfile: async () => {},
  renameProfile: async () => {},
});

export function ChartProvider({ children }: { children: ReactNode }) {
  const [profiles,         setProfiles]        = useState<StoredProfile[]>([]);
  const [activeProfileIdx, setActiveProfileIdx] = useState(-1);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [profilesRaw, activeIdxRaw] = await Promise.all([
          AsyncStorage.getItem(PROFILES_KEY),
          AsyncStorage.getItem(ACTIVE_IDX_KEY),
        ]);

        if (profilesRaw) {
          const parsed: StoredProfile[] = JSON.parse(profilesRaw);
          setProfiles(parsed);
          const idx = activeIdxRaw !== null ? parseInt(activeIdxRaw, 10) : 0;
          setActiveProfileIdx(Math.min(idx, parsed.length - 1));
        } else {
          // Migrate legacy single-profile storage
          const [legacyId, legacyTz] = await Promise.all([
            AsyncStorage.getItem(LEGACY_CHART_KEY),
            AsyncStorage.getItem(LEGACY_TZ_KEY),
          ]);
          if (legacyId) {
            const migrated: StoredProfile[] = [{
              chartId: legacyId,
              timezone: legacyTz ?? 'Asia/Jakarta',
              nickname: 'Profil Saya',
              createdAt: new Date().toISOString(),
            }];
            setProfiles(migrated);
            setActiveProfileIdx(0);
            await Promise.all([
              AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(migrated)),
              AsyncStorage.setItem(ACTIVE_IDX_KEY, '0'),
              AsyncStorage.removeItem(LEGACY_CHART_KEY),
              AsyncStorage.removeItem(LEGACY_TZ_KEY),
            ]);
          } else {
            setActiveProfileIdx(-1);
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const _persist = async (newProfiles: StoredProfile[], newIdx: number) => {
    await Promise.all([
      AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(newProfiles)),
      AsyncStorage.setItem(ACTIVE_IDX_KEY, String(newIdx)),
    ]);
    setProfiles(newProfiles);
    setActiveProfileIdx(newIdx);
  };

  const activeProfile = activeProfileIdx >= 0 && activeProfileIdx < profiles.length
    ? profiles[activeProfileIdx]
    : null;

  const chartId  = activeProfile?.chartId  || null;
  const timezone = activeProfile?.timezone ?? 'Asia/Jakarta';

  const setChart = async (id: string, tz: string) => {
    if (activeProfileIdx >= 0 && activeProfileIdx < profiles.length) {
      // Update existing active profile
      const updated = profiles.map((p, i) =>
        i === activeProfileIdx ? { ...p, chartId: id, timezone: tz } : p
      );
      await _persist(updated, activeProfileIdx);
    } else {
      // No profile yet — create the first one
      const newProfile: StoredProfile = {
        chartId: id, timezone: tz,
        nickname: 'Profil Saya',
        createdAt: new Date().toISOString(),
      };
      const updated = [...profiles, newProfile];
      await _persist(updated, updated.length - 1);
    }
  };

  const clearChart = async () => {
    await removeActiveProfile();
  };

  const switchProfile = async (idx: number) => {
    if (idx < 0 || idx >= profiles.length) return;
    await AsyncStorage.setItem(ACTIVE_IDX_KEY, String(idx));
    setActiveProfileIdx(idx);
  };

  const addNewProfile = async () => {
    // Add a blank placeholder; ProfileScreen sees chartId=null → shows onboarding
    const placeholder: StoredProfile = {
      chartId: '',
      timezone: 'Asia/Jakarta',
      nickname: `Profil ${profiles.length + 1}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...profiles, placeholder];
    await _persist(updated, updated.length - 1);
  };

  const removeActiveProfile = async () => {
    if (profiles.length === 0) return;
    const updated = profiles.filter((_, i) => i !== activeProfileIdx);
    const newIdx = updated.length > 0 ? Math.max(0, activeProfileIdx - 1) : -1;
    await _persist(updated, newIdx);
  };

  const renameProfile = async (idx: number, nickname: string) => {
    if (idx < 0 || idx >= profiles.length) return;
    const updated = profiles.map((p, i) => i === idx ? { ...p, nickname } : p);
    await _persist(updated, activeProfileIdx);
  };

  return (
    <ChartContext.Provider value={{
      chartId, timezone, setChart, clearChart, loading,
      profiles, activeProfileIdx, switchProfile,
      addNewProfile, removeActiveProfile, renameProfile,
    }}>
      {children}
    </ChartContext.Provider>
  );
}

export function useChart() {
  return useContext(ChartContext);
}
