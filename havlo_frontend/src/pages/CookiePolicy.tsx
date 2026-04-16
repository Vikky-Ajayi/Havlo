import React from 'react';

export const CookiePolicy: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-white">
      <div className="max-w-[1440px] w-full px-0 pt-16 pb-16 ml-[98px] mr-[98px]">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-6 mb-12">
          <h1 className="font-display text-[64px] lg:text-[80px] font-black leading-none tracking-[-1.6px] text-black">
            Cookie Policy
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
              1. What Are Cookies?
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              Cookies are small text files stored on your device when you visit a website. They help improve functionality, performance, and user experience.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              2. How Havlo Uses Cookies
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Havlo uses cookies to:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Ensure the website functions properly</li>
                <li>Understand how users interact with the Platform</li>
                <li>Improve performance and usability</li>
                <li>Remember user preferences</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              3. Types of Cookies We Use
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li><strong>Essential cookies:</strong> Required for basic website functionality</li>
                <li><strong>Analytics cookies:</strong> Help us understand usage and improve the Platform</li>
                <li><strong>Preference cookies:</strong> Remember your settings and choices</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              4. Managing Cookies
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              You can control or disable cookies through your browser settings. Disabling certain cookies may affect the functionality of the website.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              5. Updates to This Policy
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              Some cookies may be placed by third-party services used on the Platform (e.g., analytics tools). These cookies are governed by the third party’s policies.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              6. Your Rights
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              We may update this Cookie Policy periodically. Any changes will be posted on this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
