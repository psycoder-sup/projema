import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full border-2 border-ink bg-paper px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground file:border-0 file:bg-transparent file:font-mono file:text-sm file:font-medium focus-visible:outline-none focus-visible:shadow-brut-sm focus-visible:-translate-x-[1px] focus-visible:-translate-y-[1px] transition-[transform,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
