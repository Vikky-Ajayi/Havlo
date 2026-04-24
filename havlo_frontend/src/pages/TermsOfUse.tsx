import React from 'react';
import { usePageMeta } from '../hooks/usePageMeta';

export const TermsOfUse: React.FC = () => {
  usePageMeta({
    title: "Terms of Use | Havlo",
    description: "Review Havlo's Terms of Use to understand our services, user responsibilities, and legal guidelines when using our website and property solutions.",
    canonical: 'https://www.heyhavlo.com/terms',
  });
  return (
    <div className="flex flex-col w-full max-w-full gap-10">
      <div className="max-w-[1440px] w-full px-4 sm:px-8 lg:px-[98px] pt-10 sm:pt-16 pb-16 mx-auto">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-6 mb-12">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[80px] font-black leading-none tracking-[-1.6px] text-black break-words">
            Terms of Use
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
              These Terms of Use (“Terms”) govern your access to and use of the Havlo website, platform, and related services (collectively, the “Platform”). By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, you must not use the Platform.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              2. About Havlo
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Havlo is a platform that helps individuals buy property abroad by providing information, guidance, and facilitation services.</p>
              <p>Havlo operates under different registered entities:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Registered in England and Wales as Sprint Technologies</li>
              </ul>
              <p>References to “Havlo,” “we,” “us,” or “our” refer to the Havlo platform and its operating entities, as applicable.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              3. Scope of Services
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Havlo provides general information and support related to purchasing property outside a user’s country of residence. This may include:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Educational content about buying property abroad</li>
                <li>Guidance based on user-stated goals (e.g. investment or second home)</li>
                <li>Introductions to third-party professionals or service providers</li>
              </ul>
              <p>Havlo does not act as a real estate agent, broker, lawyer, financial advisor, or tax advisor unless explicitly stated in writing.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              4. No Professional Advice
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              All information provided through the Platform is for general informational purposes only. Nothing on the Platform constitutes legal, financial, tax, or investment advice. You are solely responsible for obtaining independent professional advice before making any property-related decisions.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              5. User Responsibilities
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>By using the Platform, you agree to:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Provide accurate and truthful information</li>
                <li>Use the Platform only for lawful purposes</li>
                <li>Not misuse, copy, or attempt to reverse engineer any part of the Platform</li>
                <li>Not rely solely on Havlo for final decision-making</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              6. Third-Party Services
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Havlo may connect you with third-party service providers, professionals, or partners. Havlo is not responsible for:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>The quality, accuracy, or outcome of third-party services</li>
                <li>Any agreements entered into between you and third parties</li>
                <li>Any loss or damage arising from third-party actions or omissions</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              7. Intellectual Property
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              All content on the Platform, including text, branding, logos, and design, is owned by or licensed to Havlo. You may not copy, reproduce, distribute, or exploit any content without prior written permission.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              8. Limitation of Liability
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>To the fullest extent permitted by law, Havlo shall not be liable for any direct, indirect, incidental, or consequential loss or damage arising from:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>Use of or reliance on the Platform</li>
                <li>Property purchases or related decisions</li>
                <li>Inaccuracies, omissions, or changes in foreign property laws</li>
                <li>Actions or services of third parties</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              9. Availability and Changes
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              Havlo may modify, suspend, or discontinue any part of the Platform at any time without notice. We may also update these Terms from time to time. Continued use of the Platform constitutes acceptance of the updated Terms.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              10. Governing Law
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              These Terms shall be governed by and construed in accordance with the laws of United Kingdom, without regard to conflict of law principles.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              11. Contact
            </h2>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              For questions regarding these Terms, please contact Havlo through the official communication channels listed on the Platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
