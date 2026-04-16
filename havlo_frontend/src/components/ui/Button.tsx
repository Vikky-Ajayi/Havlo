import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '../../lib/utils';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'purple' | 'outline' | 'ghost';
  size?: 'nav' | 'hero' | 'default';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  ...props
}) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-black/80',
    purple: 'bg-havlo-purple text-white hover:bg-havlo-purple/90',
    secondary: 'bg-[#F4F4F4] text-black hover:bg-gray-200',
    outline: 'border border-[#F4F4F4] bg-transparent text-black hover:bg-gray-50',
    ghost: 'bg-transparent text-black hover:bg-gray-100',
  };

  const sizes = {
    nav: 'h-[48px] px-5 text-[16px] tracking-[-0.32px]',
    hero: 'h-[56px] px-8 text-[18px] tracking-[-0.054px]',
    default: 'h-[48px] px-6 text-[16px]',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center rounded-pill font-body font-bold transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
};
