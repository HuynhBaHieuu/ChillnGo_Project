import { Check, LoaderCircle } from 'lucide-react'
import * as React from 'react'
import { createContext, useContext } from 'react'

import { cn } from '@/lib/utils'

type StepState = 'active' | 'completed' | 'inactive' | 'loading'

type StepperContextValue = {
  activeStep: number
  setActiveStep: (step: number) => void
  orientation: 'horizontal' | 'vertical'
}

type StepItemContextValue = {
  step: number
  state: StepState
  isDisabled: boolean
  isLoading: boolean
}

const StepperContext = createContext<StepperContextValue | undefined>(undefined)
const StepItemContext = createContext<StepItemContextValue | undefined>(undefined)

function useStepper() {
  const context = useContext(StepperContext)
  if (!context) throw new Error('useStepper must be used within a Stepper')
  return context
}

function useStepItem() {
  const context = useContext(StepItemContext)
  if (!context) throw new Error('useStepItem must be used within a StepperItem')
  return context
}

interface StepperProps extends React.ComponentProps<'div'> {
  defaultValue?: number
  value?: number
  onValueChange?: (value: number) => void
  orientation?: 'horizontal' | 'vertical'
}

/** Steps in a row (or column); the step at `value` is active, the ones before it completed. */
function Stepper({ defaultValue = 0, value, onValueChange, orientation = 'horizontal', className, ...props }: StepperProps) {
  const [activeStep, setInternalStep] = React.useState(defaultValue)

  const setActiveStep = React.useCallback(
    (step: number) => {
      if (value === undefined) setInternalStep(step)
      onValueChange?.(step)
    },
    [value, onValueChange],
  )

  return (
    <StepperContext.Provider value={{ activeStep: value ?? activeStep, setActiveStep, orientation }}>
      <div
        className={cn(
          'group/stepper inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col',
          className,
        )}
        data-orientation={orientation}
        {...props}
      />
    </StepperContext.Provider>
  )
}

interface StepperItemProps extends React.ComponentProps<'div'> {
  step: number
  completed?: boolean
  disabled?: boolean
  loading?: boolean
}

function StepperItem({ step, completed = false, disabled = false, loading = false, className, children, ...props }: StepperItemProps) {
  const { activeStep } = useStepper()
  const state: StepState = completed || step < activeStep ? 'completed' : activeStep === step ? 'active' : 'inactive'
  const isLoading = loading && step === activeStep

  return (
    <StepItemContext.Provider value={{ step, state, isDisabled: disabled, isLoading }}>
      <div
        className={cn(
          'group/step flex items-center group-data-[orientation=horizontal]/stepper:flex-row group-data-[orientation=vertical]/stepper:flex-col',
          className,
        )}
        data-state={state}
        {...(isLoading ? { 'data-loading': true } : {})}
        {...props}
      >
        {children}
      </div>
    </StepItemContext.Provider>
  )
}

interface StepperTriggerProps extends React.ComponentProps<'button'> {
  asChild?: boolean
}

function StepperTrigger({ asChild = false, className, children, ...props }: StepperTriggerProps) {
  const { setActiveStep } = useStepper()
  const { step, isDisabled } = useStepItem()

  if (asChild) return <div className={className}>{children}</div>

  return (
    <button
      type="button"
      className={cn('inline-flex items-center gap-3 disabled:pointer-events-none disabled:opacity-50', className)}
      onClick={() => setActiveStep(step)}
      disabled={isDisabled}
      {...props}
    >
      {children}
    </button>
  )
}

interface StepperIndicatorProps extends React.ComponentProps<'div'> {
  asChild?: boolean
}

/** The step's circle: its number, a check once completed, a spinner while loading. */
function StepperIndicator({ asChild = false, className, children, ...props }: StepperIndicatorProps) {
  const { state, step, isLoading } = useStepItem()

  return (
    <div
      className={cn(
        'relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=completed]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:text-primary-foreground',
        className,
      )}
      data-state={state}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          <span className="transition-all group-data-[loading=true]/step:scale-0 group-data-[state=completed]/step:scale-0 group-data-[loading=true]/step:opacity-0 group-data-[state=completed]/step:opacity-0 group-data-[loading=true]/step:transition-none">
            {step}
          </span>
          <Check
            className="absolute scale-0 opacity-0 transition-all group-data-[state=completed]/step:scale-100 group-data-[state=completed]/step:opacity-100"
            size={16}
            strokeWidth={2}
            aria-hidden="true"
          />
          {isLoading && (
            <span className="absolute transition-all">
              <LoaderCircle className="animate-spin" size={14} strokeWidth={2} aria-hidden="true" />
            </span>
          )}
        </>
      )}
    </div>
  )
}

function StepperTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-sm font-medium', className)} {...props} />
}

function StepperDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function StepperSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'm-0.5 bg-muted group-data-[orientation=horizontal]/stepper:h-0.5 group-data-[orientation=vertical]/stepper:h-12 group-data-[orientation=horizontal]/stepper:w-full group-data-[orientation=vertical]/stepper:w-0.5 group-data-[orientation=horizontal]/stepper:flex-1 group-data-[state=completed]/step:bg-primary',
        className,
      )}
      {...props}
    />
  )
}

export { Stepper, StepperDescription, StepperIndicator, StepperItem, StepperSeparator, StepperTitle, StepperTrigger }
