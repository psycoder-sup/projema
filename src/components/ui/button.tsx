import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-xs font-bold uppercase tracking-wider ring-offset-background transition-[transform,box-shadow,background-color] duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-2 border-ink bg-ink text-paper shadow-brut-sm hover:shadow-brut hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        acid:
          'border-2 border-ink bg-acid text-ink shadow-brut-sm hover:shadow-brut hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        destructive:
          'border-2 border-ink bg-rust text-white shadow-brut-sm hover:shadow-brut hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        outline:
          'border-2 border-ink bg-transparent text-foreground hover:bg-acid hover:text-ink',
        secondary:
          'border-2 border-ink bg-paper text-ink shadow-brut-xs hover:bg-acid active:translate-x-[1px] active:translate-y-[1px] active:shadow-none',
        ghost:
          'border-2 border-transparent text-foreground hover:border-ink hover:bg-acid hover:text-ink',
        link:
          'text-foreground underline decoration-2 underline-offset-[6px] hover:decoration-acid hover:text-ink',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-[10px]',
        lg: 'h-12 px-6 text-sm',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
