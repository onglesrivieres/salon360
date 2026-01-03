import React, { useRef, useEffect, useState } from 'react';
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
  const [shouldUseKeypad, setShouldUseKeypad] = useState(() => window.innerWidth <= 1366);

  useEffect(() => {
    const handleResize = () => {
      setShouldUseKeypad(window.innerWidth <= 1366);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openCustomKeypad = (target: HTMLInputElement) => {
    const constraints = {
      min: min !== undefined ? parseFloat(min.toString()) : undefined,
      max: max !== undefined ? parseFloat(max.toString()) : undefined,
      step: parseFloat(step.toString()),
    };

    const handleKeypadChange = (newValue: string) => {
      const syntheticEvent = {
        target: {
          value: newValue,
          name: target.name,
          type: 'number',
        },
        currentTarget: target,
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
          target: target,
          currentTarget: target,
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
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLInputElement>) => {
    if (useKeypad && shouldUseKeypad && !disabled && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      if (inputRef.current) {
        inputRef.current.blur();
        openCustomKeypad(e.currentTarget);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    if (useKeypad && shouldUseKeypad && !disabled && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      if (inputRef.current) {
        inputRef.current.blur();
        openCustomKeypad(e.currentTarget);
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (useKeypad && shouldUseKeypad && !disabled && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      e.target.blur();
      openCustomKeypad(e.target);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (useKeypad && shouldUseKeypad && !disabled && !readOnly) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
      openCustomKeypad(e.currentTarget);
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

  const isKeypadActive = useKeypad && shouldUseKeypad && !disabled && !readOnly;

  const hasWidthClass = /\b(w-|min-w-|max-w-)/.test(className);
  const widthClass = hasWidthClass ? '' : 'w-full';

  return (
    <input
      ref={inputRef}
      type={isKeypadActive ? 'text' : 'number'}
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onMouseDown={handleMouseDown}
      onBlur={handleBlur}
      className={`${widthClass} px-3 py-3 md:py-1.5 text-base md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] md:min-h-0 disabled:bg-gray-100 disabled:cursor-not-allowed ${isKeypadActive ? 'cursor-pointer' : ''} ${className}`}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      readOnly={isKeypadActive || readOnly}
      inputMode={isKeypadActive ? 'none' : 'decimal'}
      pattern={isKeypadActive ? '[0-9]*' : undefined}
      {...props}
    />
  );
}
