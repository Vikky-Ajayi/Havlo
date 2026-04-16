import React, { useState } from 'react';
import { motion } from 'motion/react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Button } from '../components/ui/Button';
import { Eye, EyeOff, User, Mail, Phone, Lock } from 'lucide-react';

export const DashboardSettings: React.FC = () => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic to save changes would go here
  };

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-[1162px] mx-auto px-6 lg:px-0 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Profile Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 lg:p-10 space-y-8 shadow-sm border border-[#F1F1F0]"
          >
            <div className="space-y-4">
              <h2 className="font-display text-[32px] font-black text-black tracking-[-0.64px]">Profile</h2>
              <div className="h-[1px] bg-black/10 w-full" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                {/* Full Name */}
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Full name</label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="Enter name" 
                      defaultValue="Freeborn Ehirhere"
                      className="w-full h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Email</label>
                  <div className="relative group">
                    <input 
                      type="email" 
                      placeholder="Enter email" 
                      defaultValue="freeborn@example.com"
                      className="w-full h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                  </div>
                </div>

                {/* Contact Phone */}
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Contact phone</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 bg-[#DDD] rounded-lg h-12 cursor-pointer hover:bg-gray-300 transition-colors">
                      <span className="text-sm font-medium text-black/80">+44</span>
                      <svg width="8" height="4" viewBox="0 0 8 4" fill="none">
                        <path opacity="0.8" d="M0 0L4 4L8 0" fill="black" fillOpacity="0.8"/>
                      </svg>
                    </div>
                    <input 
                      type="tel" 
                      placeholder="0000 0000 000" 
                      className="flex-1 h-12 px-4 rounded-lg border border-white bg-black/5 font-body text-sm font-medium text-black placeholder:text-[#676B80]/50 focus:outline-none focus:ring-1 focus:ring-black/10 transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit"
                  className="h-[60px] px-8 rounded-full bg-black text-white font-body text-base font-semibold tracking-[-0.32px] uppercase hover:bg-black/90 transition-colors border-none"
                >
                  SAVE CHANGES
                </Button>
              </div>
            </form>
          </motion.div>

          {/* Change Password Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 lg:p-10 space-y-8 shadow-sm border border-[#F1F1F0]"
          >
            <div className="space-y-4">
              <h2 className="font-display text-[32px] font-black text-black tracking-[-0.64px]">Change password</h2>
              <div className="h-[1px] bg-black/10 w-full" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-6">
                {/* Current Password */}
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Current password</label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? "text" : "password"} 
                      placeholder="--------" 
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

                {/* New Password */}
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">New password</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      placeholder="--------" 
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

                {/* Confirm Password */}
                <div className="space-y-4">
                  <label className="block font-display text-sm font-bold text-[#001C47]">Confirm password</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="--------" 
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

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit"
                  className="h-[60px] px-8 rounded-full bg-black text-white font-body text-base font-semibold tracking-[-0.32px] uppercase hover:bg-black/90 transition-colors border-none"
                >
                  SAVE CHANGES
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};
