import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Menu, 
  ChevronDown, 
  LayoutGrid, 
  Building2, 
  Star, 
  Zap, 
  FileText, 
  Users, 
  Mail, 
  User, 
  Settings, 
  LogOut,
  ArrowRight
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

const ROLE_VISIBLE: Record<string, string[]> = {
  buyer: [
    '/dashboard',
    '/dashboard/property-matching',
    '/dashboard/inbox',
    '/dashboard/settings',
  ],
  seller: [
    '/dashboard',
    '/dashboard/elite-property',
    '/dashboard/sell-faster',
    '/dashboard/sale-audit',
    '/dashboard/buyer-network',
    '/dashboard/inbox',
    '/dashboard/settings',
  ],
  agent: [
    '/dashboard',
    '/dashboard/buyer-network',
    '/dashboard/inbox',
    '/dashboard/settings',
  ],
};

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const userRole = user?.role || 'buyer';
  const userName = user ? `${user.first_name} ${user.last_name}` : 'User';
  const allowedPaths = ROLE_VISIBLE[userRole] || ROLE_VISIBLE.buyer;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const allSidebarItems = [
    {
      title: 'MAIN',
      items: [
        { 
          icon: <LayoutGrid size={20} />, 
          label: 'Buy Property Abroad', 
          path: '/dashboard',
          active: location.pathname === '/dashboard' 
        },
        { 
          icon: <Building2 size={20} />, 
          label: 'Property Matching', 
          path: '/dashboard/property-matching',
          active: location.pathname === '/dashboard/property-matching'
        },
      ]
    },
    {
      title: 'PROPERTY',
      items: [
        { 
          icon: <Star size={20} />, 
          label: 'Elite Property Introductions', 
          path: '/dashboard/elite-property',
          active: location.pathname === '/dashboard/elite-property'
        },
        { 
          icon: <Zap size={20} />, 
          label: 'Sell faster — Relaunch', 
          path: '/dashboard/sell-faster',
          active: location.pathname === '/dashboard/sell-faster'
        },
        { 
          icon: <FileText size={20} />, 
          label: 'Property Sale Audit', 
          path: '/dashboard/sale-audit',
          active: location.pathname === '/dashboard/sale-audit'
        },
      ]
    },
    {
      title: 'NETWORK',
      items: [
        { 
          icon: <Users size={20} />, 
          label: 'International Buyer Network', 
          path: '/dashboard/buyer-network',
          active: location.pathname === '/dashboard/buyer-network'
        },
      ]
    },
    {
      title: 'MESSAGES',
      items: [
        { 
          icon: <Mail size={20} />, 
          label: 'Inbox', 
          badge: 0, 
          path: '/dashboard/inbox',
          active: location.pathname === '/dashboard/inbox'
        },
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { icon: <User size={20} />, label: userName, bold: true, path: '/dashboard/settings' },
        { 
          icon: <Settings size={20} />, 
          label: 'Settings', 
          path: '/dashboard/settings',
          active: location.pathname === '/dashboard/settings'
        },
        { icon: <LogOut size={20} />, label: 'Logout', onClick: handleLogout },
      ]
    }
  ];

  const sidebarItems = allSidebarItems
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.onClick || !item.path || section.title === 'ACCOUNT' || allowedPaths.includes(item.path)
      ),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="flex h-screen bg-[#F4F5F4] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        .sidebar-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}} />
      
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col border-r border-[#F1F1F0] bg-white transition-all duration-300 relative ${isCollapsed ? 'w-[80px]' : 'w-[300px]'}`}>
        <div className={`h-16 flex items-center border-b border-[#F1F1F0] transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'px-8'}`}>
          {!isCollapsed ? (
            <Link to="/" aria-label="Go to homepage">
              <img
                src="https://api.builder.io/api/v1/image/assets/TEMP/2a7671c12cd9eeba4b100270f10d5f94932da00f?width=204"
                alt="Havlo"
                className="h-6"
              />
            </Link>
          ) : (
            <Link to="/" aria-label="Go to homepage" className="h-8 w-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl">H</span>
            </Link>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 h-6 w-6 bg-white border border-[#F1F1F0] rounded-full flex items-center justify-center z-10 hover:bg-gray-50 shadow-sm"
        >
          <motion.div
            animate={{ rotate: isCollapsed ? 180 : 0 }}
          >
            <ArrowRight size={12} className="text-black" />
          </motion.div>
        </button>

        <div className="flex-1 overflow-y-auto py-8 sidebar-scrollbar">
          {sidebarItems.map((section, idx) => (
            <div key={idx} className="mb-6">
              {!isCollapsed && (
                <div className="px-6 py-2 text-[14px] font-semibold text-[#666] tracking-[-0.24px] font-tight">
                  {section.title}
                </div>
              )}
              {section.items.map((item, itemIdx) => (
                <button
                  key={itemIdx}
                  onClick={() => item.onClick ? item.onClick() : navigate(item.path || '#')}
                  className={`w-full flex items-center transition-colors group ${
                    isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-4 py-3'
                  } ${
                    item.active 
                      ? 'bg-black text-white rounded-xl mx-auto' 
                      : 'text-black hover:bg-gray-50'
                  } ${!isCollapsed ? 'w-[calc(100%-32px)]' : 'w-[50px]'}`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <span className={item.active ? 'text-white' : 'text-black group-hover:scale-110 transition-transform'}>{item.icon}</span>
                    {!isCollapsed && (
                      <span className={`text-[15px] tracking-[-0.36px] font-body whitespace-nowrap ${item.bold ? 'font-bold' : item.active ? 'font-semibold' : 'font-medium'}`}>
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && item.badge !== undefined && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#A409D2] text-[12px] font-medium text-white">
                      {item.badge}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[320px] bg-white lg:hidden flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-[#F1F1F0]">
                <Link to="/" aria-label="Go to homepage" onClick={() => setIsSidebarOpen(false)}>
                  <img
                    src="https://api.builder.io/api/v1/image/assets/TEMP/2a7671c12cd9eeba4b100270f10d5f94932da00f?width=204"
                    alt="Havlo"
                    className="h-6"
                  />
                </Link>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 bg-[#EFEFEF] rounded-md"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4 sidebar-scrollbar">
                {sidebarItems.map((section, idx) => (
                  <div key={idx} className="mb-6">
                    <div className="px-6 py-2 text-[14px] font-semibold text-[#666] tracking-[-0.24px] font-tight">
                      {section.title}
                    </div>
                    {section.items.map((item, itemIdx) => (
                      <button
                        key={itemIdx}
                        onClick={() => {
                          if (item.onClick) item.onClick();
                          else navigate(item.path || '#');
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors group ${
                          item.active 
                            ? 'bg-black text-white rounded-xl mx-auto w-[calc(100%-32px)]' 
                            : 'text-black hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={item.active ? 'text-white' : 'text-black group-hover:scale-110 transition-transform'}>{item.icon}</span>
                          <span className={`text-[15px] tracking-[-0.36px] font-body whitespace-nowrap ${item.bold ? 'font-bold' : item.active ? 'font-semibold' : 'font-medium'}`}>
                            {item.label}
                          </span>
                        </div>
                        {item.badge !== undefined && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-[#A409D2] text-[12px] font-medium text-white">
                            {item.badge}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-3 sm:px-6 bg-white border-b border-[#F1F1F0] gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
            <h1 className="font-display text-lg sm:text-2xl lg:text-[32px] font-black tracking-[-0.48px] text-black truncate">
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-full hover:bg-gray-50 cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-white" />
              </div>
              <span className="hidden sm:inline font-libre text-sm font-medium tracking-[-0.42px] text-[#020202] truncate max-w-[140px]">
                {userName}
              </span>
              <ChevronDown size={16} className="text-black hidden sm:inline" />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
