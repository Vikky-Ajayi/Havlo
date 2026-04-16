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
    <div className="flex flex-col items-center gap-5 flex-1 min-w-[250px]">
      <div className="flex flex-col items-start gap-3 self-stretch">
        <TrustpilotStars className="h-[26px]" />
        <h3 className="self-stretch font-body text-[18px] font-semibold leading-[110%] tracking-[-0.36px] text-[#040504]">
          {title}
        </h3>
      </div>
      
      <p className="self-stretch font-body text-base font-normal leading-[120%] text-black">
        {content}
      </p>
      
      <div className="self-stretch font-body text-base leading-[120%] text-black">
        <span className="font-bold">{author}</span>
        {time && <span className="font-normal">, {time}</span>}
      </div>
    </div>
  );
};
