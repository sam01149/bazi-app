import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHART_KEY = '@bazi_chart_id';
const TIMEZONE_KEY = '@bazi_timezone';

interface ChartContextValue {
  chartId: string | null;
  timezone: string;
  setChart: (id: string, tz: string) => Promise<void>;
  clearChart: () => Promise<void>;
  loading: boolean;
}

const ChartContext = createContext<ChartContextValue>({
  chartId: null,
  timezone: 'Asia/Jakarta',
  setChart: async () => {},
  clearChart: async () => {},
  loading: true,
});

export function ChartProvider({ children }: { children: ReactNode }) {
  const [chartId, setChartId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [id, tz] = await Promise.all([
          AsyncStorage.getItem(CHART_KEY),
          AsyncStorage.getItem(TIMEZONE_KEY),
        ]);
        if (id) setChartId(id);
        if (tz) setTimezone(tz);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const setChart = async (id: string, tz: string) => {
    await Promise.all([
      AsyncStorage.setItem(CHART_KEY, id),
      AsyncStorage.setItem(TIMEZONE_KEY, tz),
    ]);
    setChartId(id);
    setTimezone(tz);
  };

  const clearChart = async () => {
    await Promise.all([
      AsyncStorage.removeItem(CHART_KEY),
      AsyncStorage.removeItem(TIMEZONE_KEY),
    ]);
    setChartId(null);
    setTimezone('Asia/Jakarta');
  };

  return (
    <ChartContext.Provider value={{ chartId, timezone, setChart, clearChart, loading }}>
      {children}
    </ChartContext.Provider>
  );
}

export function useChart() {
  return useContext(ChartContext);
}
