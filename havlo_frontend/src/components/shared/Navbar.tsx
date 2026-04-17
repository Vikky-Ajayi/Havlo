import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const Navbar: React.FC = () => {
  const { openModal } = useModal();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenSection(null);
  }, [location.pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      openModal('create-account');
    }
    setIsMobileMenuOpen(false);
  };

  const handleLoginClick = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      openModal('login');
    }
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { 
      name: 'Services', 
      href: '#',
      vectorSrc: "https://c.animaapp.com/KKHOxPDD/img/vector.svg",
      dropdownItems: [
        { name: 'Buy Property Abroad', href: '/buy-abroad' },
        { name: 'Property management', href: '#' },
        { name: 'Sell your property', href: '/relaunch-assessment' },
        { name: 'International Buyer Network', href: '/buyer-network' },
        { name: 'Complete home-buying service', href: '/buy-home' },
      ]
    },
    { 
      name: 'Who we are', 
      href: '#',
      vectorSrc: "https://c.animaapp.com/KKHOxPDD/img/vector-1.svg",
      dropdownItems: [
        { name: 'About', href: '/about' },
        { name: 'FAQ', href: '/faq' },
        { name: 'Contact Us', href: '/contact' },
        { name: 'Press', href: '#' },
      ]
    },
    { 
      name: 'Havlo Exclusives', 
      href: '/elite-property',
      vectorSrc: "https://c.animaapp.com/KKHOxPDD/img/vector-2.svg"
    },
    { 
      name: 'Referrals', 
      href: '/referrals'
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#F4F4F4] bg-white backdrop-blur-[5px] backdrop-brightness-[100%]">
      <div className="flex h-20 w-full items-center justify-between px-6 lg:px-[100px] py-3">
        <Link to="/" className="flex-shrink-0">
          <img
            src="https://c.animaapp.com/KKHOxPDD/img/havlo-black-transparent@2x.png"
            alt="Havlo Logo"
            className="w-[136.25px] h-8 aspect-[4.26] object-cover"
            referrerPolicy="no-referrer"
          />
        </Link>
 
        <nav className="hidden items-center gap-8 lg:flex">
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <div key={link.name} className="group relative">
                <Link 
                  to={link.href}
                  className="flex items-center gap-1 cursor-pointer py-2"
                >
                  <span className="font-body text-base font-bold text-black opacity-80 transition-opacity group-hover:opacity-100 tracking-[-0.32px] leading-6 whitespace-nowrap">
                    {link.name}
                  </span>
                  {link.vectorSrc && (
                    <img
                      className="relative w-[9.33px] h-[5.33px] mr-[-0.67px]"
                      alt="Vector"
                      src={link.vectorSrc}
                    />
                  )}
                </Link>

                {link.dropdownItems && (
                  <div className="absolute left-0 top-full hidden w-[280px] flex-col gap-1 rounded-xl bg-white p-2 shadow-xl border border-[#F4F4F4] group-hover:flex">
                    {link.dropdownItems.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className="rounded-lg px-4 py-3 font-body text-sm font-semibold text-black/70 hover:bg-[#F4F4F4] hover:text-black transition-colors"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6">
              {user ? (
                <>
                  <Button
                    variant="primary"
                    className="h-12 px-5 py-3 rounded-[48px] bg-black text-white font-bold text-base tracking-[-0.32px] leading-6 whitespace-nowrap"
                    onClick={() => navigate('/dashboard')}
                  >
                    Dashboard
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-[120px] h-12 px-5 py-3 rounded-[48px] bg-[#F4F4F4] text-black font-bold text-base tracking-[-0.32px] leading-6 whitespace-nowrap"
                    onClick={handleLogout}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="w-[120px] h-12 px-5 py-3 rounded-[48px] bg-[#F4F4F4] text-black font-bold text-base tracking-[-0.32px] leading-6 whitespace-nowrap"
                    onClick={handleLoginClick}
                  >
                    Log in
                  </Button>
                  <Button
                    variant="primary"
                    className="h-12 px-5 py-3 rounded-[48px] bg-black text-white font-bold text-base tracking-[-0.32px] leading-6 whitespace-nowrap"
                    onClick={handleGetStarted}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>

          </div>
        </nav>

        <div className="flex items-center gap-3 lg:hidden">
          <button
            className="flex p-3"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <>
          <div
            className={cn(
              'fixed inset-0 top-20 z-[60] bg-black/40 transition-opacity duration-300 lg:hidden',
              isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          <aside
            className={cn(
              'fixed top-20 bottom-0 right-0 z-[70] w-[85%] max-w-[380px] bg-white shadow-2xl transition-transform duration-300 lg:hidden flex flex-col',
              isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            )}
            aria-hidden={!isMobileMenuOpen}
          >
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="flex flex-col">
            {navLinks.map((link) => {
              const hasDropdown = !!link.dropdownItems?.length;
              if (hasDropdown) {
                return (
                  <div key={link.name} className="mb-4">
                    <div className="px-6 py-2 font-body text-[13px] font-semibold uppercase tracking-[0.5px] text-[#666]">
                      {link.name}
                    </div>
                    {link.dropdownItems!.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            'mx-4 flex items-center justify-between rounded-xl px-4 py-3 font-body text-[15px] transition-colors',
                            isActive
                              ? 'bg-black text-white font-semibold'
                              : 'text-black hover:bg-[#F4F4F4] font-medium'
                          )}
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                );
              }
              const isActive = location.pathname === link.href;
              return (
                <div key={link.name} className="mb-1">
                  <Link
                    to={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'mx-4 flex items-center justify-between rounded-xl px-4 py-3 font-body text-[15px] transition-colors',
                      isActive
                        ? 'bg-black text-white font-semibold'
                        : 'text-black hover:bg-[#F4F4F4] font-bold'
                    )}
                  >
                    {link.name}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#F4F4F4] p-6 flex flex-col gap-3">
          {user ? (
            <>
              <Button
                variant="primary"
                fullWidth
                onClick={() => { navigate('/dashboard'); setIsMobileMenuOpen(false); }}
              >
                Dashboard
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={handleLogout}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                fullWidth
                onClick={handleLoginClick}
              >
                Log in
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleGetStarted}
              >
                Get Started
              </Button>
            </>
          )}
        </div>
          </aside>
        </>,
        document.body
      )}
    </header>
  );
};
