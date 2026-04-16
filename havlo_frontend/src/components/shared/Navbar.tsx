import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const Navbar: React.FC = () => {
  const { openModal } = useModal();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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

            <img
              className="relative w-14 h-8 cursor-pointer"
              alt="Country code"
              src="https://c.animaapp.com/KKHOxPDD/img/country-code-container.svg"
            />
          </div>
        </nav>

        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex w-14 h-8 px-1.5 items-center gap-2 rounded-[32px] bg-[#F3F5F7] cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_uk)">
                <mask id="mask0_uk" style={{ maskType: 'luminance' }} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
                  <path d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z" fill="white"/>
                </mask>
                <g mask="url(#mask0_uk)">
                  <path d="M0 0L0.375 1.03125L0 2.10938V3.1875L1.5 5.71875L0 8.25V9.75L1.5 12L0 14.25V15.75L1.5 18.2812L0 20.8125V24L1.03125 23.625L2.10938 24H3.1875L5.71875 22.5L8.25 24H9.75L12 22.5L14.25 24H15.75L18.2812 22.5L20.8125 24H24L23.625 22.9688L24 21.8906V20.8125L22.5 18.2812L24 15.75V14.25L22.5 12L24 9.75V8.25L22.5 5.71875L24 3.1875V0L22.9688 0.375L21.8906 0H20.8125L18.2812 1.5L15.75 0H14.25L12 1.5L9.75 0H8.25L5.71875 1.5L3.1875 0H0Z" fill="#EEEEEE"/>
                  <path d="M15.75 0V5.0625L20.8125 0H15.75ZM24 3.1875L18.9375 8.25H24V3.1875ZM0 8.25H5.0625L0 3.1875V8.25ZM3.1875 0L8.25 5.0625V0H3.1875ZM8.25 24V18.9375L3.1875 24H8.25ZM0 20.8125L5.0625 15.75H0V20.8125ZM24 15.75H18.9375L24 20.8125V15.75ZM20.8125 24L15.75 18.9375V24H20.8125Z" fill="#0052B4"/>
                  <path d="M0 0V2.10938L6.14062 8.25H8.25L0 0ZM9.75 0V9.75H0V14.25H9.75V24H14.25V14.25H24V9.75H14.25V0H9.75ZM21.8906 0L15.75 6.14062V8.25L24 0H21.8906ZM8.25 15.75L0 24H2.10938L8.25 17.8594V15.75ZM15.75 15.75L24 24V21.8906L17.8594 15.75H15.75Z" fill="#D80027"/>
                </g>
              </g>
              <defs>
                <clipPath id="clip0_uk">
                  <rect width="24" height="24" fill="white"/>
                </clipPath>
              </defs>
            </svg>
            <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0L4 4L8 0" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <button
            className="flex p-3"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          'fixed inset-0 top-20 z-40 bg-white transition-transform duration-300 lg:hidden overflow-y-auto',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col p-6 gap-6">
          {navLinks.map((link) => (
            <div key={link.name} className="flex flex-col gap-4">
              <Link
                to={link.href}
                className="font-body text-xl font-bold text-black"
                onClick={() => !link.dropdownItems && setIsMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
              {link.dropdownItems && (
                <div className="flex flex-col gap-4 pl-4">
                  {link.dropdownItems.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className="font-body text-lg font-semibold text-black/60"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <hr className="border-[#F4F4F4]" />
          <div className="flex flex-col gap-4">
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
                  onClick={() => {
                    openModal('login');
                    setIsMobileMenuOpen(false);
                  }}
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
        </div>
      </div>
    </header>
  );
};
