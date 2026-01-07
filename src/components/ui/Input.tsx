'use client';

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, HTMLAttributes, useRef, useEffect, useImperativeHandle, ReactNode } from 'react';

type Variant = 'default' | 'glass';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  default: 'bg-white/40 border border-white/50 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30',
  glass: 'backdrop-blur-xl backdrop-saturate-150 bg-white/20 border border-white/40 focus:bg-white/30 focus:border-white/50'
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-5 py-3 text-lg'
};

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: Variant;
  size?: Size;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}, ref) => {
  const classes = [
    'w-full rounded-lg outline-none transition-all duration-200 ease-out',
    variants[variant],
    sizes[size],
    disabled && 'opacity-50 cursor-not-allowed',
    className
  ].filter(Boolean).join(' ');

  return <input ref={ref} type={type} className={classes} disabled={disabled} {...props} />;
});

Input.displayName = 'Input';

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  variant?: Variant;
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({
  variant = 'default',
  autoResize = true,
  minRows = 1,
  maxRows = 8,
  disabled = false,
  className = '',
  value,
  onChange,
  ...props
}, ref) => {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current!);

  useEffect(() => {
    if (autoResize && innerRef.current) {
      const el = innerRef.current;
      el.style.height = 'auto';
      const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 24;
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      const scrollHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
      el.style.height = `${scrollHeight}px`;
    }
  }, [value, autoResize, minRows, maxRows]);

  const classes = [
    'w-full rounded-lg outline-none transition-all duration-200 ease-out resize-none px-4 py-2',
    variants[variant],
    disabled && 'opacity-50 cursor-not-allowed',
    className
  ].filter(Boolean).join(' ');

  return (
    <textarea ref={innerRef} className={classes} value={value} onChange={onChange} disabled={disabled} rows={minRows} {...props} />
  );
});

TextArea.displayName = 'TextArea';

interface InputWrapperProps extends HTMLAttributes<HTMLDivElement> {
  focus?: boolean;
  children?: ReactNode;
}

export const InputWrapper = forwardRef<HTMLDivElement, InputWrapperProps>(({
  focus = false,
  className = '',
  children,
  ...props
}, ref) => {
  const classes = [
    'backdrop-blur-2xl backdrop-saturate-150 bg-white/25',
    'border border-white/40 rounded-2xl p-3 transition-all duration-300 ease-out',
    focus && 'bg-white/35 border-white/50 ring-1 ring-white/30',
    className
  ].filter(Boolean).join(' ');

  return <div ref={ref} className={classes} {...props}>{children}</div>;
});

InputWrapper.displayName = 'InputWrapper';
export default Input;
