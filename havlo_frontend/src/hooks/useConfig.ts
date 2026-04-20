import { useEffect, useState } from 'react';

interface PublicConfig {
  calendly_link: string;
}

const DEFAULT_CONFIG: PublicConfig = {
  calendly_link: '',
};

let cached: PublicConfig | null = null;

export function useConfig() {
  const [config, setConfig] = useState<PublicConfig>(cached ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (cached) {
      setConfig(cached);
      return;
    }
    fetch('/api/v1/config')
      .then((r) => r.json())
      .then((data: PublicConfig) => {
        cached = data;
        setConfig(data);
      })
      .catch(() => {});
  }, []);

  return config;
}
