import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SIMPLE_MODE_KEY = '@bazi_simple_mode';

interface SimpleModeValue {
  simpleMode: boolean;
  toggleSimpleMode: () => Promise<void>;
}

const SimpleModeContext = createContext<SimpleModeValue>({
  simpleMode: false,
  toggleSimpleMode: async () => {},
});

export function SimpleModeProvider({ children }: { children: ReactNode }) {
  const [simpleMode, setSimpleMode] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SIMPLE_MODE_KEY).then(val => {
      if (val === 'true') setSimpleMode(true);
    });
  }, []);

  const toggleSimpleMode = async () => {
    const next = !simpleMode;
    setSimpleMode(next);
    await AsyncStorage.setItem(SIMPLE_MODE_KEY, String(next));
  };

  return (
    <SimpleModeContext.Provider value={{ simpleMode, toggleSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export function useSimpleMode() {
  return useContext(SimpleModeContext);
}
