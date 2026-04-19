import React from 'react';

export const PrivacyPolicy: React.FC = () => {
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
              Last updated: 10/10/24
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
                <li>Legal or regulatory authorities if required by law</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              5. Data Security
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              We implement reasonable technical and organizational measures to protect your data. However, no system is completely secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              6. Your Rights
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
              7. Data Retention
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              We retain personal data only for as long as necessary to fulfill the purposes outlined in this policy or to meet legal requirements.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              8. Changes to This Policy
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
