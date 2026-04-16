import React from 'react';
import { cn } from '../../lib/utils';

interface DifferenceCardProps {
  number: string;
  title: string;
  description: string;
  className?: string;
}

export const DifferenceCard: React.FC<DifferenceCardProps> = ({
  number,
  title,
  description,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex h-[322px] flex-col justify-between items-start rounded-card bg-havlo-purple-dark p-[32px_20px] overflow-hidden flex-1 min-w-[280px]',
        className
      )}
    >
      {/* Number Pill */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FEFFFF]">
        <span className="font-body text-[20px] font-semibold tracking-[-0.4px] text-black">
          {number}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col items-start gap-6 self-stretch">
        <h3 className="self-stretch font-tight text-card-title font-bold text-white">
          {title}
        </h3>
        <p className="self-stretch font-body text-base font-medium leading-[1.5] tracking-[-0.64px] text-white">
          {description}
        </p>
      </div>
    </div>
  );
};
