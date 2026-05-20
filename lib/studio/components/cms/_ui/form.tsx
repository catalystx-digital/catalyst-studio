"use client";

import * as React from 'react';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  useFormField,
} from '@/components/ui/form';
import type { ControllerProps, FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { ComponentTheme } from '../_core/types';
import { themeClass } from './classnames';

/**
 * CmsForm wrappers - Thin wrappers around shadcn Form components
 * Only add: theme class propagation via context
 * All styling comes from shadcn
 */

interface CmsFormContextValue { theme?: ComponentTheme }
const CmsFormContext = React.createContext<CmsFormContextValue>({});
export const useCmsFormContext = () => React.useContext(CmsFormContext);

export interface CmsFormProps<TFieldValues extends FieldValues = FieldValues> extends UseFormReturn<TFieldValues> {
  theme?: ComponentTheme;
  className?: string;
  children: React.ReactNode;
  /** Optional variant styling - passed through for data attributes */
  variant?: string;
}

export function CmsForm<TFieldValues extends FieldValues>({
  theme,
  className,
  children,
  ...form
}: CmsFormProps<TFieldValues>) {
  return (
    <CmsFormContext.Provider value={{ theme }}>
      <Form {...form}>{children}</Form>
    </CmsFormContext.Provider>
  );
}

export type CmsFormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = ControllerProps<TFieldValues, TName>;

export function CmsFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: CmsFormFieldProps<TFieldValues, TName>) {
  return <FormField {...props} />;
}

export interface CmsFormItemProps extends React.ComponentPropsWithoutRef<typeof FormItem> {
  theme?: ComponentTheme;
}

export const CmsFormItem = React.forwardRef<HTMLDivElement, CmsFormItemProps>(
  ({ className, theme, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsFormContext();
    return <FormItem ref={ref} className={cn(themeClass(theme ?? ctxTheme), className)} {...props} />;
  },
);
CmsFormItem.displayName = 'CmsFormItem';

export interface CmsFormLabelProps extends React.ComponentPropsWithoutRef<typeof FormLabel> {
  theme?: ComponentTheme;
}

export const CmsFormLabel = React.forwardRef<HTMLLabelElement, CmsFormLabelProps>(
  ({ className, theme, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsFormContext();
    return <FormLabel ref={ref} className={cn(themeClass(theme ?? ctxTheme), className)} {...props} />;
  },
);
CmsFormLabel.displayName = 'CmsFormLabel';

export interface CmsFormControlProps extends React.ComponentPropsWithoutRef<typeof FormControl> {}

export const CmsFormControl = React.forwardRef<React.ElementRef<typeof FormControl>, CmsFormControlProps>(
  (props, ref) => <FormControl ref={ref} {...props} />,
);
CmsFormControl.displayName = 'CmsFormControl';

export interface CmsFormDescriptionProps extends React.ComponentPropsWithoutRef<typeof FormDescription> {
  theme?: ComponentTheme;
}

export const CmsFormDescription = React.forwardRef<HTMLParagraphElement, CmsFormDescriptionProps>(
  ({ className, theme, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsFormContext();
    return <FormDescription ref={ref} className={cn(themeClass(theme ?? ctxTheme), className)} {...props} />;
  },
);
CmsFormDescription.displayName = 'CmsFormDescription';

export interface CmsFormMessageProps extends React.ComponentPropsWithoutRef<typeof FormMessage> {
  theme?: ComponentTheme;
  variant?: 'default' | 'destructive';
}

export const CmsFormMessage = React.forwardRef<HTMLParagraphElement, CmsFormMessageProps>(
  ({ className, theme, variant, ...props }, ref) => {
    const { theme: ctxTheme } = useCmsFormContext();
    return (
      <FormMessage
        ref={ref}
        className={cn(variant === 'destructive' && 'text-destructive', themeClass(theme ?? ctxTheme), className)}
        {...props}
      />
    );
  },
);
CmsFormMessage.displayName = 'CmsFormMessage';

export { useFormField as useCmsFormField };

export const CmsFormRoot = React.forwardRef<HTMLFormElement, React.FormHTMLAttributes<HTMLFormElement>>(
  ({ className, ...props }, ref) => {
    const { theme } = useCmsFormContext();
    return <form ref={ref} className={cn('grid gap-6', themeClass(theme), className)} {...props} />;
  },
);
CmsFormRoot.displayName = 'CmsFormRoot';
