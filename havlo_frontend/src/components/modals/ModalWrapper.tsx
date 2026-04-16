import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useModal } from '../../hooks/useModal';

export const ModalWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { closeModal } = useModal();

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-center overflow-y-auto p-[10px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
          className="fixed inset-0 bg-black/50 backdrop-blur-[10px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-[500px] my-auto overflow-hidden bg-white shadow-2xl rounded-[24px]"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
