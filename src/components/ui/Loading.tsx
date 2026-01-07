'use client';

import { forwardRef, HTMLAttributes, CSSProperties, ReactNode } from 'react';

type Size = 'sm' | 'md' | 'lg';
type SkeletonVariant = 'text' | 'circle' | 'rect';

const spinnerSizes: Record<Size, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]'
};

interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: Size;
}

export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(({
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const classes = [
    'rounded-full animate-spin border-blue-500 border-t-transparent',
    spinnerSizes[size],
    className
  ].filter(Boolean).join(' ');

  return <span ref={ref} className={classes} {...props} />;
});

Spinner.displayName = 'Spinner';

interface LoadingBubbleProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
  shimmer?: boolean;
}

export const LoadingBubble = forwardRef<HTMLDivElement, LoadingBubbleProps>(({
  text = '加载中',
  shimmer = true,
  className = '',
  ...props
}, ref) => {
  const classes = [
    'inline-flex items-center gap-2 px-4 py-2 rounded-full',
    'backdrop-blur-xl backdrop-saturate-150 bg-white/25',
    'border border-white/40 transition-all duration-300 ease-out',
    className
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} {...props}>
      <span className="text-sm text-gray-600">
        {text}
        {shimmer && <span className="animate-pulse">...</span>}
      </span>
    </div>
  );
});

LoadingBubble.displayName = 'LoadingBubble';

interface ShimmerTextProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

export const ShimmerText = forwardRef<HTMLSpanElement, ShimmerTextProps>(({
  className = '',
  children,
  ...props
}, ref) => {
  const classes = ['animate-pulse text-gray-500', className].filter(Boolean).join(' ');
  return <span ref={ref} className={classes} {...props}>{children}</span>;
});

ShimmerText.displayName = 'ShimmerText';

const skeletonVariants: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  circle: 'rounded-full aspect-square',
  rect: 'rounded-lg'
};

interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(({
  variant = 'text',
  width,
  height,
  className = '',
  style = {},
  ...props
}, ref) => {
  const classes = [
    'block animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]',
    skeletonVariants[variant],
    className
  ].filter(Boolean).join(' ');

  return <span ref={ref} className={classes} style={{ width, height, ...style } as CSSProperties} {...props} />;
});

Skeleton.displayName = 'Skeleton';
export default LoadingBubble;
