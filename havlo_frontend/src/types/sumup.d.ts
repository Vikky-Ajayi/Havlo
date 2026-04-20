interface SumUpCardConfig {
  id: string;
  checkoutId: string;
  onResponse: (type: string, body?: unknown) => void;
  showSubmitButton?: boolean;
  showZipCode?: boolean;
  showEmail?: boolean;
  showInstallments?: boolean;
  locale?: string;
}

interface SumUpCardStatic {
  mount: (config: SumUpCardConfig) => void;
  unmount: () => void;
}

declare global {
  interface Window {
    SumUpCard?: SumUpCardStatic;
  }
}

export {};
