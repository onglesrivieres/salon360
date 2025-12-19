import React, { useRef, useEffect } from 'react';
import { useNumericKeypad } from '../../contexts/NumericKeypadContext';

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  useKeypad?: boolean;
}

export function NumericInput({
  value,
  onChange,
  onBlur,
  className = '',
  min,
  max,
  step = '0.01',
  disabled,
  readOnly,
  useKeypad = true,
  ...props
}: NumericInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { openKeypad } = useNumericKeypad();
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (useKeypad && isTouchDevice && !disabled && !readOnly) {
      e.preventDefault();
      e.target.blur();

      const constraints = {
        min: min !== undefined ? parseFloat(min.toString()) : undefined,
        max: max !== undefined ? parseFloat(max.toString()) : undefined,
        step: parseFloat(step.toString()),
      };

      const handleKeypadChange = (newValue: string) => {
        const syntheticEvent = {
          target: {
            value: newValue,
            name: e.target.name,
            type: 'number',
          },
          currentTarget: e.target,
          bubbles: true,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 0,
          isTrusted: true,
          nativeEvent: new Event('change'),
          preventDefault: () => {},
          isDefaultPrevented: () => false,
          stopPropagation: () => {},
          isPropagationStopped: () => false,
          persist: () => {},
          timeStamp: Date.now(),
          type: 'change',
        } as React.ChangeEvent<HTMLInputElement>;

        onChange(syntheticEvent);
      };

      const handleKeypadBlur = () => {
        if (onBlur) {
          const syntheticEvent = {
            target: e.target,
            currentTarget: e.target,
            relatedTarget: null,
            bubbles: true,
            cancelable: false,
            defaultPrevented: false,
            eventPhase: 0,
            isTrusted: true,
            nativeEvent: new Event('blur'),
            preventDefault: () => {},
            isDefaultPrevented: () => false,
            stopPropagation: () => {},
            isPropagationStopped: () => false,
            persist: () => {},
            timeStamp: Date.now(),
            type: 'blur',
          } as React.FocusEvent<HTMLInputElement>;

          onBlur(syntheticEvent);
        }
      };

      openKeypad(
        inputRef,
        value.toString(),
        constraints,
        handleKeypadChange,
        handleKeypadBlur
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      ref={inputRef}
      type="number"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`w-full px-3 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0 disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      readOnly={readOnly}
      {...props}
    />
  );
}
