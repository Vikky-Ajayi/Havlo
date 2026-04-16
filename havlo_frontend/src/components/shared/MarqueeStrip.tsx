import React from 'react';
import { motion } from 'motion/react';

const marqueeItems = [
  'International Property Purchase',
  'International Property Exposure',
];

export const MarqueeStrip: React.FC = () => {
  return (
    <div className="relative flex w-full overflow-hidden bg-white py-4 lg:py-8 border-y border-[#F4F4F4]">
      <motion.div
        animate={{
          x: [0, -1000], // Adjust based on content width
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="flex items-center gap-4 lg:gap-8 whitespace-nowrap"
      >
        {/* Render items multiple times for seamless loop */}
        {[...Array(6)].map((_, i) => (
          <React.Fragment key={i}>
            {marqueeItems.map((item, index) => (
              <div key={`${i}-${index}`} className="flex items-center gap-4 lg:gap-8">
                <span className="font-display text-[20px] lg:text-[48px] font-black uppercase text-black">
                  {item}
                </span>
                <div className="h-3 w-3 lg:h-4 lg:w-4 rounded-full bg-[#602FD3] opacity-60" />
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
