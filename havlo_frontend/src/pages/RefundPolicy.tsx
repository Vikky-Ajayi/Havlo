import React from 'react';
import { usePageMeta } from '../hooks/usePageMeta';

export const RefundPolicy: React.FC = () => {
  usePageMeta({
    title: "Refund Policy | Havlo",
    description: "Havlo's refund policy for the Property Listing Assessment Report.",
    canonical: 'https://www.heyhavlo.com/refund-policy',
  });
  return (
    <div className="flex flex-col w-full bg-white">
      <div className="max-w-[1440px] w-full px-4 sm:px-8 lg:px-[98px] pt-10 sm:pt-16 pb-16 mx-auto">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-6 mb-12">
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[80px] font-black leading-none tracking-[-1.6px] text-black break-words">
            Refund Policy
          </h1>
          <div className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-black/10 bg-[#E9E8E8]">
            <span className="font-body text-lg font-bold text-[#323546]">
              Last updated: 23/09/26
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col w-full max-w-[1240px] gap-10">
          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              Havlo Property Listing Assessment Report
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Each Havlo Property Listing Assessment is a bespoke service prepared specifically for the individual property.</p>
              <p>Before a unique access code is issued, Havlo has already undertaken the analysis and preparation of the property assessment. This includes reviewing the relevant property information, analysing the property's listing and market position, and preparing a detailed assessment report based on the information available to us.</p>
              <p>The unique Property ID/access code provided to you is used to allow you to access the assessment report that has already been prepared for your property. It does not initiate the assessment work.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="font-body text-2xl font-semibold tracking-[-0.36px] text-[#030517]">
              Refunds
            </h2>
            <div className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546] flex flex-col gap-4">
              <p>Because the assessment work is carried out and the report is prepared before the unique access code is issued, payments are non-refundable once the assessment report has been issued and made available to the customer.</p>
              <p>By proceeding with the purchase and requesting access to your Property Listing Assessment, you acknowledge that:</p>
              <ul className="list-disc pl-8 flex flex-col gap-1">
                <li>The assessment has been specifically prepared for your property.</li>
                <li>Havlo has undertaken analysis and preparation before providing access to the report.</li>
                <li>The unique access code provides access to an assessment that has already been prepared.</li>
                <li>Once the assessment report has been issued and made available, the payment is non-refundable, subject to any rights you may have under applicable consumer law.</li>
                <li>The assessment is not a valuation, survey, structural assessment or guarantee that your property will sell.</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              Please read this policy carefully before proceeding.
            </p>
            <p className="font-body text-lg font-medium leading-[1.5] tracking-[-0.27px] text-[#323546]">
              If you do not agree to these refund terms, please do not proceed with requesting or paying for access to your Property Listing Assessment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
