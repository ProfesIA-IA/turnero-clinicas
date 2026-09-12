import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

const ClinicContext = createContext(null);

export function ClinicProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [settings, setSettings] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [enabledIds, setEnabledIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [settingsRes, proRes, serviceRes] = await Promise.all([
        api.settings(),
        api.professionals(),
        api.services(),
      ]);
      setSettings(settingsRes.data);
      setProfessionals(proRes.data);
      setServices(serviceRes.data);
      setEnabledIds((prev) => {
        if (prev.length) return prev.filter((id) => proRes.data.some((item) => item.id === id));
        return proRes.data.filter((item) => item.active).map((item) => item.id);
      });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);

  const tz = settings?.timezone || 'America/Argentina/Buenos_Aires';

  const value = useMemo(
    () => ({
      settings,
      professionals,
      services,
      viewDate,
      setViewDate,
      enabledIds,
      setEnabledIds,
      loading,
      reload,
      tz,
    }),
    [settings, professionals, services, viewDate, enabledIds, loading, reload, tz]
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider');
  return ctx;
}
