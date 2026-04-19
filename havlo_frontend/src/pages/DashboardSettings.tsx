import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';

export const DashboardSettings: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneCode, setPhoneCode] = useState('+44');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhoneCode(user.phone_country_code || '+44');
      setPhoneNumber(user.phone_number || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setProfileLoading(true);
    setProfileError('');
    setProfileMsg('');
    try {
      await api.updateProfile(token, {
        first_name: firstName,
        last_name: lastName,
        phone_country_code: phoneCode,
        phone_number: phoneNumber,
      });
      await refreshUser();
      setProfileMsg('Profile updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordLoading(true);
    setPasswordError('');
    setPasswordMsg('');
    try {
      await api.changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-[1162px] mx-auto px-4 sm:px-6 lg:px-0 py-6 lg:py-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 lg:p-10 space-y-8 shadow-sm border border-[#F1F1F0]"
          >
            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-[32px] font-black text-black tracking-[-0.64px]">Profile</h2>
              <div className="h-[1px] bg-black/10 w-full" />
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-bold text-[#001C47]">First name</label>
                    <input 
                      type="text" 
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="block font-display text-sm font-bold text-[#001C47]">Last name</label>
                    <input 
                      type="text" 
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Email</label>
                  <input 
                    type="email" 
                    value={email}
                    disabled
                    className="w-full h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black/50 focus:outline-none transition-all cursor-not-allowed" 
                  />
                </div>

                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Contact phone</label>
                  <div className="flex gap-2 items-center">
                    <div className="h-12 px-2 bg-[#DDD] rounded-lg flex items-center">
                      <CountryCodeSelect value={phoneCode} onChange={setPhoneCode} buttonClassName="bg-transparent hover:bg-black/5" />
                    </div>
                    <input 
                      type="tel" 
                      placeholder="0000 0000 000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                  </div>
                </div>
              </div>

              {profileError && <p className="text-red-500 text-sm font-body">{profileError}</p>}
              {profileMsg && <p className="text-green-600 text-sm font-body">{profileMsg}</p>}

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit"
                  disabled={profileLoading}
                  className="h-[60px] px-8 rounded-full bg-black text-white font-body text-base font-semibold tracking-[-0.32px] uppercase hover:bg-black/90 transition-colors border-none disabled:opacity-50"
                >
                  {profileLoading ? 'SAVING...' : 'SAVE CHANGES'}
                </Button>
              </div>
            </form>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 lg:p-10 space-y-8 shadow-sm border border-[#F1F1F0]"
          >
            <div className="space-y-4">
              <h2 className="font-display text-2xl sm:text-[32px] font-black text-black tracking-[-0.64px]">Change password</h2>
              <div className="h-[1px] bg-black/10 w-full" />
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Current password</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="--------"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full h-12 px-4 pr-12 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#AEAFB0] hover:text-black transition-colors"
                    >
                      {showCurrentPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">New password</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"}
                      placeholder="--------"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-12 px-4 pr-12 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#AEAFB0] hover:text-black transition-colors"
                    >
                      {showNewPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Confirm password</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="--------"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-12 px-4 pr-12 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#AEAFB0] hover:text-black transition-colors"
                    >
                      {showConfirmPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {passwordError && <p className="text-red-500 text-sm font-body">{passwordError}</p>}
              {passwordMsg && <p className="text-green-600 text-sm font-body">{passwordMsg}</p>}

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit"
                  disabled={passwordLoading}
                  className="h-[60px] px-8 rounded-full bg-black text-white font-body text-base font-semibold tracking-[-0.32px] uppercase hover:bg-black/90 transition-colors border-none disabled:opacity-50"
                >
                  {passwordLoading ? 'SAVING...' : 'SAVE CHANGES'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};
