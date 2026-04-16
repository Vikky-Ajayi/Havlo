import React from 'react';
import { TrustpilotStars } from '../ui/TrustpilotStars';

interface ReviewCardProps {
  title: string;
  content: string;
  author: string;
  time: string;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  title,
  content,
  author,
  time,
}) => {
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-4">
      <div className="flex w-full min-w-0 flex-col items-start gap-3">
        <TrustpilotStars className="h-[26px]" />
        <h3 className="w-full break-words font-body text-[16px] font-semibold leading-[120%] tracking-[-0.32px] text-[#040504]">
          {title}
        </h3>
      </div>

      <p className="w-full break-words font-body text-[14px] font-normal leading-[140%] text-black/80">
        {content}
      </p>

      <div className="w-full break-words font-body text-[14px] leading-[140%] text-black">
        <span className="font-bold">{author}</span>
        {time && <span className="font-normal">, {time}</span>}
      </div>
    </div>
  );
};
