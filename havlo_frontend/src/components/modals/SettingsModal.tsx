import React, { useState, useEffect } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useModal } from '../../hooks/useModal';
import { Button } from '../ui/Button';
import { X, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

type Tab = 'profile' | 'password';

export const SettingsModal: React.FC = () => {
  const { closeModal, activeModal } = useModal();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Sync tab with activeModal type if it changes
  useEffect(() => {
    if (activeModal === 'settings-password') {
      setActiveTab('password');
    } else {
      setActiveTab('profile');
    }
  }, [activeModal]);

  return (
    <ModalWrapper>
      <div className="flex flex-col gap-8 p-8 sm:p-[32px_24px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[32px] font-black leading-none text-black">
            Settings
          </h2>
          <button
            onClick={closeModal}
            className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#3A3C3E] text-white/80 transition-colors hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-20">
          <div className="flex flex-col gap-8">
            {/* Tabs */}
            <div className="flex flex-wrap gap-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={cn(
                  'flex h-14 min-w-[130px] items-center justify-center rounded-xl px-4 font-body text-base font-medium transition-all',
                  activeTab === 'profile'
                    ? 'bg-black text-white'
                    : 'border border-[#242628] text-black opacity-80 hover:bg-black/5'
                )}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={cn(
                  'flex h-14 min-w-[166px] items-center justify-center rounded-xl px-4 font-body text-base font-medium transition-all',
                  activeTab === 'password'
                    ? 'bg-black text-white'
                    : 'border border-[#242628] text-black opacity-80 hover:bg-black/5'
                )}
              >
                Change Password
              </button>
            </div>

            {/* Form Content */}
            <div className="flex flex-col gap-6">
              {activeTab === 'profile' ? (
                <>
                  <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                    <input
                      type="text"
                      placeholder="First name"
                      className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    />
                  </div>
                  <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                    <input
                      type="text"
                      placeholder="Last name"
                      className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    />
                  </div>
                  <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                    <input
                      type="email"
                      placeholder="Email"
                      className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      placeholder="Current Password"
                      className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="text-[#AEAFB0] transition-colors hover:text-black"
                    >
                      {showCurrentPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>
                  <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="New Password"
                      className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="text-[#AEAFB0] transition-colors hover:text-black"
                    >
                      {showNewPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>
                  <div className="relative flex items-center rounded-xl border border-black/10 bg-[#242628]/[0.05] p-4">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm New Password"
                      className="w-full bg-transparent font-body text-base font-medium text-black outline-none placeholder:text-black/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-[#AEAFB0] transition-colors hover:text-black"
                    >
                      {showConfirmPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button variant="primary" className="h-14 w-full rounded-[48px] text-lg font-bold">
            Save Changes
          </Button>
        </div>
      </div>
    </ModalWrapper>
  );
};
