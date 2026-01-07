'use client';

import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'icon';
type Size = 'sm' | 'md' | 'lg';
type Shape = 'default' | 'circle' | 'pill';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  shape?: Shape;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  default: `
    backdrop-blur-xl backdrop-saturate-150
    bg-white/20 border border-white/40
    text-gray-700
    hover:bg-white/30 hover:border-white/50
    active:bg-white/40
  `,
  primary: `
    backdrop-blur-xl backdrop-saturate-150
    bg-blue-500/80 border border-blue-400/50
    text-white
    hover:bg-blue-500/90 hover:border-blue-400/70
    active:bg-blue-600/90
  `,
  ghost: `
    bg-transparent border border-transparent
    text-gray-600
    hover:bg-white/20 hover:text-gray-800
    active:bg-white/30
  `,
  danger: `
    backdrop-blur-xl backdrop-saturate-150
    bg-red-500/80 border border-red-400/50
    text-white
    hover:bg-red-500/90 hover:border-red-400/70
    active:bg-red-600/90
  `,
  icon: `
    bg-transparent border border-transparent
    text-gray-500
    hover:bg-white/20 hover:text-gray-700
    active:bg-white/30
  `
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5'
};

const shapes: Record<Shape, string> = {
  default: 'rounded-xl',
  circle: 'rounded-full aspect-square',
  pill: 'rounded-full'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'default',
  size = 'md',
  shape = 'default',
  disabled = false,
  loading = false,
  icon,
  className = '',
  children,
  ...props
}, ref) => {
  const isIconOnly = !children && icon;

  const classes = [
    'inline-flex items-center justify-center font-medium',
    'transition-all duration-200 ease-out',
    'active:scale-[0.98]',
    variants[variant].replace(/\s+/g, ' ').trim(),
    sizes[size],
    shapes[shape],
    isIconOnly && 'p-2',
    disabled && 'opacity-50 cursor-not-allowed',
    loading && 'cursor-wait',
    className
  ].filter(Boolean).join(' ');

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
