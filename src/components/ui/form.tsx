'use client';

import * as React from 'react';
import * as Slot from '@radix-ui/react-slot';
import { Controller, ControllerProps, FieldPath, FieldValues, FormProvider, useFormContext } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export { useFormContext, FormProvider, Controller };

interface FormFieldContextProps<T extends FieldValues> {
  name: FieldPath<T>;
}

const FormFieldContext = React.createContext<FormFieldContextProps<FieldValues>>({} as FormFieldContextProps<FieldValues>);

export function FormField<T extends FieldValues>({
  ...props
}: ControllerProps<T>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

export function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const { formState, ...formContext } = useFormContext();
  const fieldState = formState.errors[fieldContext.name] ? { invalid: true, isDirty: true } : { invalid: false, isDirty: false };
  const fieldProps = { ...formContext, ...fieldState, name: fieldContext.name };
  return { ...fieldContext, ...fieldProps };
}

export interface FormProps<T extends FieldValues> extends React.ComponentPropsWithoutRef<'form'> {
  onSubmit: (values: T) => void;
  defaultValues?: Partial<T>;
}

export function Form<T extends FieldValues>({ onSubmit, defaultValues, children, ...props }: FormProps<T>) {
  const form = React.useMemo(() => import('react-hook-form').then(m => m.useForm<T>({ defaultValues })), [defaultValues]);
  // Note: In real implementation, use useForm directly. This is a simplified version.
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} {...props}>
        {children}
      </form>
    </FormProvider>
  );
}

export interface FormItemProps extends React.HTMLAttributes<HTMLDivElement> {}

export const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-2', className)} {...props} />
  )
);
FormItem.displayName = 'FormItem';

export interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {}

export const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, ...props }, ref) => (
    <Label ref={ref} className={cn('', className)} {...props} />
  )
);
FormLabel.displayName = 'FormLabel';

export interface FormControlProps extends React.ComponentPropsWithoutRef<typeof Slot> {}

export const FormControl = React.forwardRef<HTMLDivElement, FormControlProps>(
  ({ className, ...props }, ref) => (
    <Slot ref={ref} className={cn('', className)} {...props} />
  )
);
FormControl.displayName = 'FormControl';

export interface FormDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const FormDescription = React.forwardRef<HTMLParagraphElement, FormDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
FormDescription.displayName = 'FormDescription';

export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, ...props }, ref) => {
    const { invalid, name } = useFormField();
    const message = invalid ? children : null;
    if (!message) return null;
    return (
      <p ref={ref} className={cn('text-sm text-destructive', className)} {...props}>
        {message}
      </p>
    );
  }
);
FormMessage.displayName = 'FormMessage';

// Convenience components
export function FormInput<T extends FieldValues>({
  ...props
}: ControllerProps<T> & React.ComponentPropsWithoutRef<typeof Input>) {
  const { field, fieldState, formState } = useFormField();
  return (
    <FormControl>
      <Input
        {...field}
        {...props}
        disabled={formState.isSubmitting}
        aria-invalid={fieldState.invalid}
      />
    </FormControl>
  );
}

export function FormTextarea<T extends FieldValues>({
  ...props
}: ControllerProps<T> & React.ComponentPropsWithoutRef<typeof Textarea>) {
  const { field, fieldState, formState } = useFormField();
  return (
    <FormControl>
      <Textarea
        {...field}
        {...props}
        disabled={formState.isSubmitting}
        aria-invalid={fieldState.invalid}
      />
    </FormControl>
  );
}

export function FormSelect<T extends FieldValues>({
  options,
  ...props
}: ControllerProps<T> & { options: { value: string; label: string }[] } & React.ComponentPropsWithoutRef<typeof SelectTrigger>) {
  const { field, fieldState, formState } = useFormField();
  return (
    <FormControl>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <SelectTrigger {...props} aria-invalid={fieldState.invalid} disabled={formState.isSubmitting}>
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormControl>
  );
}

export function FormSwitch<T extends FieldValues>({
  ...props
}: ControllerProps<T> & React.ComponentPropsWithoutRef<typeof Switch>) {
  const { field, fieldState, formState } = useFormField();
  return (
    <FormControl>
      <Switch
        {...field}
        {...props}
        checked={field.value}
        onCheckedChange={field.onChange}
        disabled={formState.isSubmitting}
        aria-invalid={fieldState.invalid}
      />
    </FormControl>
  );
}