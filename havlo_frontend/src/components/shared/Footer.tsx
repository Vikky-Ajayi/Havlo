import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

export const Footer: React.FC = () => {
  const serviceLinks = [
    { name: 'Buy Property Abroad', href: '/buy-abroad' },
    { name: 'Property management', href: '#' },
    { name: 'Sell your property', href: '/relaunch-assessment' },
    { name: 'International Buyer Network', href: '/buyer-network' },
    { name: 'Complete home-buying service', href: '/buy-home' },
  ];

  const whoWeAreLinks = [
    { name: 'About', href: '/about' },
    { name: 'FAQ', href: '/faq' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'Press', href: '#' },
  ];

  const legalLinks = [
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Privacy Policy', href: '/privacy-policy' },
    { name: 'Cookie Policy', href: '/cookie-policy' },
  ];

  return (
    <footer className="w-full bg-[#040504] overflow-hidden flex flex-col items-center py-10">
      <div className="w-full max-w-[1600px] px-4 lg:px-14 py-10 lg:py-14 rounded-[32px] bg-[#050505] flex flex-col gap-14 mx-2 lg:mx-auto">
        {/* Top Row: Newsletter & Socials */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="relative flex h-14 w-full sm:w-[377px] items-center rounded-[56px] bg-[#1F1F1E] px-6">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-transparent font-body text-base font-semibold text-white placeholder:text-white/50 focus:outline-none"
              />
            </div>
            <Button
              variant="secondary"
              className="h-14 px-5 rounded-[56px] font-bold bg-white text-black hover:bg-gray-200 transition-colors w-full sm:w-auto"
            >
              Join Newsletter
            </Button>
          </div>

          <div className="flex items-center gap-7">
            {[
              { id: 'fb', icon: <FacebookIcon /> },
              { id: 'ig', icon: <InstagramIcon /> },
              { id: 'x', icon: <XIcon /> },
            ].map((social) => (
              <a
                key={social.id}
                href="#"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1F1F1E] transition-colors hover:bg-white/20"
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Middle Row: Logo/Rating & Links */}
        <div className="flex flex-col lg:flex-row justify-between gap-16">
          <div className="flex flex-col items-center lg:items-start gap-3">
            <img
              src="https://c.animaapp.com/KKHOxPDD/img/havlo-black-transparent@2x.png"
              alt="Havlo Logo"
              className="h-8 w-auto brightness-0 invert"
              referrerPolicy="no-referrer"
            />
            <div className="origin-top lg:origin-top-left scale-[0.7] flex flex-col items-center lg:items-start gap-4">
              <div className="flex items-center gap-1">
                <StarIcon />
                <span className="font-body text-[32px] font-medium tracking-[-0.64px] text-[#FEFFFF]">
                  Rated
                </span>
              </div>
              <TrustpilotStarsLarge />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 lg:gap-24 text-center lg:text-left">
            <LinkGroup title="Services" links={serviceLinks} />
            <LinkGroup title="Who we are" links={whoWeAreLinks} />
            <LinkGroup title="Legal" links={legalLinks} />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="font-body text-sm lg:text-base font-medium leading-normal tracking-[-0.32px] text-white/80 lg:text-left text-justify mt-[0px] mb-[-30px]">
          Havlo is a trading style of Sprint Technologies, registered in England and Wales (Company No. 14949509). Office: 2nd Floor, Berkeley Square, London, England, W1J 6BD. Havlo provides property marketing, international property exposure, and purchase advisory services. Havlo does not act as a real estate agent, broker, lawyer, financial advisor, or tax advisor, unless explicitly stated otherwise. All information provided is for general guidance only and does not constitute legal, financial, tax, or investment advice. Property laws, regulations, taxation, and ownership structures vary by jurisdiction and are subject to change. Users are responsible for conducting their own due diligence and obtaining independent professional advice before making any property-related decisions.
          <br /><br />
          Havlo accepts no responsibility for decisions made based on information provided through the platform, nor for the actions, performance, or services of any third-party providers, partners, or local professionals.
          <br /><br />
          Use of this website and Havlo’s services is subject to applicable terms and conditions.
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 pt-10 text-center">
          <span className="font-body text-base lg:text-xl font-extrabold tracking-[-0.4px] text-white/70 uppercase">
            Copyright © 2026 Havlo
          </span>
        </div>
      </div>
    </footer>
  );
};

const LinkGroup = ({ title, links }: { title: string; links: { name: string; href: string }[] }) => (
  <div className="flex flex-col gap-6">
    <h4 className="font-display text-xl font-black text-white">{title}</h4>
    <div className="flex flex-col gap-8">
      {links.map((link) => (
        <Link
          key={link.name}
          to={link.href}
          className="font-body text-base font-medium tracking-[-0.32px] text-white/80 hover:text-white transition-colors"
        >
          {link.name}
        </Link>
      ))}
    </div>
  </div>
);

const FacebookIcon = () => (
  <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.4004 11.268C22.4004 5.04365 17.3856 -0.00195312 11.2004 -0.00195312C5.01242 -0.000553125 -0.00238037 5.04365 -0.00238037 11.2694C-0.00238037 16.8932 4.09402 21.5552 9.44762 22.4008V14.5258H6.60562V11.2694H9.45042V8.78445C9.45042 5.96065 11.1234 4.40105 13.6812 4.40105C14.9076 4.40105 16.1886 4.62085 16.1886 4.62085V7.39285H14.776C13.3858 7.39285 12.9518 8.26225 12.9518 9.15405V11.268H16.057L15.5614 14.5244H12.9504V22.3994C18.304 21.5538 22.4004 16.8918 22.4004 11.268Z" fill="white" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.1834 5.09554C15.9618 5.09554 15.7453 5.16123 15.5611 5.2843C15.3769 5.40737 15.2334 5.58229 15.1486 5.78694C15.0638 5.99159 15.0417 6.21679 15.0849 6.43404C15.1281 6.6513 15.2348 6.85087 15.3914 7.0075C15.548 7.16414 15.7476 7.27081 15.9649 7.31402C16.1821 7.35724 16.4073 7.33506 16.612 7.25029C16.8166 7.16552 16.9915 7.02197 17.1146 6.83778C17.2377 6.6536 17.3034 6.43706 17.3034 6.21554C17.3034 5.9185 17.1854 5.63363 16.9753 5.42358C16.7653 5.21354 16.4804 5.09554 16.1834 5.09554ZM20.4767 7.35421C20.4585 6.57982 20.3135 5.81365 20.0474 5.08621C19.81 4.4638 19.4407 3.9002 18.9647 3.43421C18.5025 2.95581 17.9376 2.58878 17.3127 2.36088C16.5872 2.08663 15.8202 1.93827 15.0447 1.92221C14.0554 1.86621 13.738 1.86621 11.1994 1.86621C8.66069 1.86621 8.34336 1.86621 7.35403 1.92221C6.57857 1.93827 5.81155 2.08663 5.08603 2.36088C4.46226 2.59108 3.89783 2.9578 3.43403 3.43421C2.95563 3.89638 2.58859 4.46129 2.36069 5.08621C2.08644 5.81173 1.93809 6.57875 1.92203 7.35421C1.86603 8.34354 1.86603 8.66088 1.86603 11.1995C1.86603 13.7382 1.86603 14.0555 1.92203 15.0449C1.93809 15.8203 2.08644 16.5874 2.36069 17.3129C2.58859 17.9378 2.95563 18.5027 3.43403 18.9649C3.89783 19.4413 4.46226 19.808 5.08603 20.0382C5.81155 20.3125 6.57857 20.4608 7.35403 20.4769C8.34336 20.5329 8.66069 20.5329 11.1994 20.5329C13.738 20.5329 14.0554 20.5329 15.0447 20.4769C15.8202 20.4608 16.5872 20.3125 17.3127 20.0382C17.9376 19.8103 18.5025 19.4433 18.9647 18.9649C19.4428 18.5006 19.8125 17.9365 20.0474 17.3129C20.3135 16.5854 20.4585 15.8193 20.4767 15.0449C20.4767 14.0555 20.5327 13.7382 20.5327 11.1995C20.5327 8.66088 20.5327 8.34354 20.4767 7.35421ZM18.7967 14.9329C18.7899 15.5253 18.6826 16.1123 18.4794 16.6689C18.3303 17.0751 18.091 17.4421 17.7794 17.7422C17.4766 18.0507 17.1104 18.2895 16.706 18.4422C16.1495 18.6454 15.5625 18.7527 14.97 18.7595C14.0367 18.8062 13.6914 18.8155 11.2367 18.8155C8.78203 18.8155 8.43669 18.8155 7.50336 18.7595C6.88819 18.7711 6.27565 18.6763 5.69269 18.4795C5.30609 18.3191 4.95663 18.0808 4.66603 17.7795C4.35624 17.4797 4.11988 17.1124 3.97536 16.7062C3.74749 16.1417 3.62111 15.5414 3.60203 14.9329C3.60203 13.9995 3.54603 13.6542 3.54603 11.1995C3.54603 8.74488 3.54603 8.39954 3.60203 7.46621C3.60621 6.86053 3.71678 6.26029 3.92869 5.69288C4.093 5.29893 4.34521 4.94776 4.66603 4.66621C4.94959 4.3453 5.30003 4.09043 5.69269 3.91954C6.26161 3.71425 6.86123 3.60695 7.46603 3.60221C8.39936 3.60221 8.74469 3.54621 11.1994 3.54621C13.654 3.54621 13.9994 3.54621 14.9327 3.60221C15.5251 3.60901 16.1122 3.71631 16.6687 3.91954C17.0928 4.07695 17.4735 4.33287 17.7794 4.66621C18.0852 4.95291 18.3242 5.30343 18.4794 5.69288C18.6868 6.26122 18.7942 6.86121 18.7967 7.46621C18.8434 8.39954 18.8527 8.74488 18.8527 11.1995C18.8527 13.6542 18.8434 13.9995 18.7967 14.9329ZM11.1994 6.41154C10.2528 6.41339 9.32799 6.69577 8.54184 7.223C7.75568 7.75023 7.14345 8.49866 6.78249 9.37371C6.42152 10.2488 6.32804 11.2112 6.51384 12.1393C6.69963 13.0675 7.15638 13.9198 7.82636 14.5885C8.49635 15.2571 9.3495 15.7122 10.278 15.8962C11.2066 16.0802 12.1688 15.9848 13.0431 15.6222C13.9175 15.2595 14.6647 14.6458 15.1904 13.8586C15.7161 13.0715 15.9967 12.1461 15.9967 11.1995C15.9979 10.5696 15.8746 9.94571 15.6339 9.36364C15.3931 8.78156 15.0396 8.25283 14.5938 7.80786C14.1479 7.36288 13.6185 7.01044 13.036 6.77081C12.4534 6.53118 11.8293 6.40908 11.1994 6.41154ZM11.1994 14.3075C10.5847 14.3075 9.98376 14.1253 9.47265 13.7838C8.96154 13.4422 8.56318 12.9568 8.32794 12.3889C8.09271 11.821 8.03116 11.1961 8.15108 10.5932C8.271 9.99031 8.56701 9.43652 9.00167 9.00186C9.43633 8.56719 9.99013 8.27119 10.593 8.15126C11.1959 8.03134 11.8208 8.09289 12.3887 8.32813C12.9567 8.56336 13.4421 8.96172 13.7836 9.47283C14.1251 9.98394 14.3074 10.5848 14.3074 11.1995C14.3074 11.6077 14.227 12.0118 14.0708 12.3889C13.9146 12.766 13.6857 13.1086 13.397 13.3972C13.1084 13.6858 12.7658 13.9148 12.3887 14.071C12.0117 14.2272 11.6075 14.3075 11.1994 14.3075Z" fill="white" />
  </svg>
);

const XIcon = () => (
  <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.354 10.758L15.772 6.784H14.962L11.995 10.234L9.625 6.784H6.892L10.476 11.999L6.892 16.165H7.702L10.836 12.523L13.34 16.165H16.073L12.354 10.758ZM11.246 12.045L10.883 11.526L7.994 7.393H9.238L11.57 10.729L11.933 11.248L14.964 15.584H13.72L11.246 12.045Z" fill="white" />
  </svg>
);

const StarIcon = () => (
  <svg width="41" height="39" viewBox="0 0 41 39" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M24.8235 14.8627H40.1588L27.7544 24.0427L32.4912 38.8902L20.0868 29.7103L7.66762 38.8902L12.4192 24.0427L0 14.8477L15.3353 14.8627L20.0868 0L24.8235 14.8627ZM27.7538 24.0413L28.8195 27.403L20.0862 29.7093L27.7538 24.0413Z" fill="white" />
  </svg>
);

const TrustpilotStarsLarge = () => (
  <svg width="259" height="51" viewBox="0 0 259 51" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0V50.0326H48.8621V0H0ZM24.4301 33.72L31.8616 31.7915L34.9659 41.5897L24.4301 33.72ZM30.9969 28.873L24.4821 33.6678L13.8962 41.4854L17.9172 28.873L7.32942 21.0554H20.4111L24.4301 8.44309L28.4511 21.0554H41.5327L30.9969 28.873Z" fill="white" />
    <path d="M52.5356 0V50.0326H101.396V0H52.5356ZM76.9657 33.72L84.3972 31.7915L87.5016 41.5896L76.9657 33.72ZM83.5306 28.873L77.0158 33.6678L66.43 41.4854L70.4509 28.873L59.8631 21.0554H72.9448L76.9657 8.44309L80.9867 21.0554H94.0665L83.5306 28.873Z" fill="white" />
    <path d="M105.07 0V50.0326H153.93V0H105.07ZM129.5 33.72L136.931 31.7915L140.036 41.5896L129.5 33.72ZM136.067 28.873L129.552 33.6678L118.964 41.4854L122.985 28.873L112.399 21.0554H125.479L129.5 8.44309L133.521 21.0554H146.601L136.067 28.873Z" fill="white" />
    <path d="M157.604 0V50.0326H206.466V0H157.604ZM182.034 33.72L189.465 31.7915L192.57 41.5896L182.034 33.72ZM188.601 28.873L182.086 33.6678L171.5 41.4854L175.519 28.873L164.933 21.0554H178.015L182.034 8.44309L186.055 21.0554H199.137L188.601 28.873Z" fill="white" />
    <path d="M210.14 0V50.0326H259V0H210.14ZM234.57 33.72L242 31.7915L245.106 41.5896L234.57 33.72ZM241.135 28.873L234.62 33.6678L224.034 41.4854L228.055 28.873L217.467 21.0554H230.549L234.57 8.44309L238.591 21.0554H251.671L241.135 28.873Z" fill="white" />
  </svg>
);
