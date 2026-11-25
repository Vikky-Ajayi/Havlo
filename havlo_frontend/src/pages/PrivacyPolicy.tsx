import React from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { resetConsent } from '../lib/consent';

export const PrivacyPolicy: React.FC = () => {
  usePageMeta({
    title: "Privacy Policy | Havlo",
    description: "Learn how Havlo collects, uses, and protects your personal information. Your privacy and data security are important to us.",
    canonical: 'https://www.heyhavlo.com/privacy-policy',
  });
  return (
    <div className="flex flex-col w-full bg-white">
      <div className="max-w-[1440px] w-full px-4 sm:px-8 lg:px-[98px] pt-10 sm:pt-16 pb-16 mx-auto">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-6 mb-12">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[80px] font-black leading-none tracking-[-1.6px] text-black break-words">
            Privacy Policy
          </h1>
          <div className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-black/10 bg-[#E9E8E8]">
            <span className="font-body text-lg font-bold text-[#323546]">
              Last updated: 24/11/26
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col w-full max-w-[1240px] gap-10">
          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              1. Introduction
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              Havlo respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and protect your information.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              2. Information We Collect
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>We may collect:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Personal information (name, email address, contact details)</li>
                <li>Property-related information you voluntarily provide</li>
                <li>Usage data (IP address, browser type, pages visited)</li>
                <li>Communication data when you contact us</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              3. How We Use Your Information
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>We use your information to:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Provide and improve our services</li>
                <li>Understand your property goals</li>
                <li>Communicate with you</li>
                <li>Connect you with relevant services or partners (with consent)</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              4. Sharing Your Information
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>We do not sell your personal data. We may share information with:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Trusted service providers or partners</li>
                <li>Meta (Facebook and Instagram), to measure and improve our advertising, as described in section 5</li>
                <li>Legal or regulatory authorities if required by law</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              5. Cookies and Advertising
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>
                We advertise on Facebook and Instagram, which are run by Meta Platforms Ireland Limited. If you accept
                cookies when our banner asks, we use the Meta Pixel and Meta&rsquo;s Conversions API to tell Meta which
                steps of our property assessment you complete, such as finding your property, starting the assessment,
                going to checkout and paying, so we can see how our adverts perform and show them to people more likely
                to find them useful.
              </p>
              <p>
                From the point you give us your details, these messages include your email address, phone number and
                name in a scrambled (hashed) form that Meta uses to match them to a Meta account, together with your IP
                address, browser details and an identifier from the advert you clicked. If you decline cookies, we send
                Meta none of this.
              </p>
              <p>
                We may also share a hashed list of the email addresses and phone numbers of people who have left their
                details with us, so Meta can stop showing our adverts for new customers to people who have already used
                our service. We leave out anyone who has unsubscribed from our emails or texts.
              </p>
              <p>
                Meta&rsquo;s use of this information is covered by its own privacy policy. You can object to this use of
                your details at any time by contacting us.
              </p>
              <p>
                <button
                  type="button"
                  className="underline font-semibold text-[#A409D2]"
                  onClick={() => { resetConsent(); window.scrollTo({ top: 0 }); }}
                >
                  Change your cookie settings
                </button>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              6. Data Security
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              We implement reasonable technical and organizational measures to protect your data. However, no system is completely secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              7. Your Rights
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Access your personal data</li>
                <li>Request correction or deletion</li>
                <li>Withdraw consent</li>
                <li>Object to certain data processing</li>
              </ul>
              <p>You may exercise these rights by contacting us.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              8. Data Retention
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              We retain personal data only for as long as necessary to fulfill the purposes outlined in this policy or to meet legal requirements.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              9. Changes to This Policy
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
