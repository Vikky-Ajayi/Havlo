export type ModalType = 
  | 'login' 
  | 'create-account' 
  | 'forgot-password' 
  | 'otp' 
  | 'new-password' 
  | 'settings-profile'
  | 'settings-password'
  | 'book-session' 
  | 'consultation'
  | 'contact-success'
  | 'opt-out'
  | null;

export interface ModalContextType {
  activeModal: ModalType;
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  switchModal: (type: ModalType) => void;
}
