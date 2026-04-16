import React, { createContext, useState, useCallback } from 'react';
import { ModalType, ModalContextType } from '../types';

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const openModal = useCallback((type: ModalType) => {
    setActiveModal(type);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const switchModal = useCallback((type: ModalType) => {
    setActiveModal(null);
    // Small timeout to allow for smooth transition if needed, 
    // but usually direct state update is fine.
    setTimeout(() => {
      setActiveModal(type);
    }, 10);
  }, []);

  return (
    <ModalContext.Provider value={{ activeModal, openModal, closeModal, switchModal }}>
      {children}
    </ModalContext.Provider>
  );
};
