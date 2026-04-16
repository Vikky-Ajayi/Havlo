import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface ServiceCardProps {
  title: string;
  description: string;
  href?: string;
  className?: string;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  description,
  href,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col justify-between items-start self-stretch rounded-[20px] bg-[#F9F9F8] p-8 overflow-hidden min-h-[245px]',
        className
      )}
    >
      <div className="flex flex-col items-start gap-6 self-stretch">
        <h3 className="self-stretch font-tight text-2xl font-bold text-[#1F1F1E] leading-none tracking-tight">
          {title}
        </h3>
        <p className="self-stretch font-body text-base font-medium leading-[1.7] tracking-[-0.048px] text-black">
          {description}
        </p>
      </div>

      {href && (
        <Link
          to={href}
          className="mt-8 inline-flex items-center gap-1 font-body text-lg font-semibold tracking-[-0.36px] text-havlo-purple uppercase hover:opacity-80 transition-opacity"
        >
          LEARN MORE →
        </Link>
      )}
    </div>
  );
};
