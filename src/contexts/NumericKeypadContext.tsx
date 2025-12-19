import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface NumericKeypadContextType {
  isOpen: boolean;
  inputRef: React.RefObject<HTMLInputElement> | null;
  value: string;
  constraints: {
    min?: number;
    max?: number;
    step?: number;
  };
  openKeypad: (
    ref: React.RefObject<HTMLInputElement>,
    initialValue: string,
    constraints: { min?: number; max?: number; step?: number },
    onChange: (value: string) => void,
    onBlur?: () => void
  ) => void;
  closeKeypad: () => void;
  updateValue: (newValue: string) => void;
  submitValue: () => void;
}

const NumericKeypadContext = createContext<NumericKeypadContextType | undefined>(undefined);

export function NumericKeypadProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputRef, setInputRef] = useState<React.RefObject<HTMLInputElement> | null>(null);
  const [value, setValue] = useState('');
  const [constraints, setConstraints] = useState<{ min?: number; max?: number; step?: number }>({});
  const onChangeRef = useRef<((value: string) => void) | null>(null);
  const onBlurRef = useRef<(() => void) | null>(null);

  const openKeypad = useCallback(
    (
      ref: React.RefObject<HTMLInputElement>,
      initialValue: string,
      inputConstraints: { min?: number; max?: number; step?: number },
      onChange: (value: string) => void,
      onBlur?: () => void
    ) => {
      setInputRef(ref);
      setValue(initialValue);
      setConstraints(inputConstraints);
      onChangeRef.current = onChange;
      onBlurRef.current = onBlur || null;
      setIsOpen(true);
    },
    []
  );

  const closeKeypad = useCallback(() => {
    setIsOpen(false);
    if (onBlurRef.current) {
      onBlurRef.current();
    }
    setTimeout(() => {
      setInputRef(null);
      setValue('');
      setConstraints({});
      onChangeRef.current = null;
      onBlurRef.current = null;
    }, 300);
  }, []);

  const updateValue = useCallback((newValue: string) => {
    setValue(newValue);
    if (onChangeRef.current) {
      onChangeRef.current(newValue);
    }
  }, []);

  const submitValue = useCallback(() => {
    closeKeypad();
  }, [closeKeypad]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeKeypad();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, closeKeypad]);

  return (
    <NumericKeypadContext.Provider
      value={{
        isOpen,
        inputRef,
        value,
        constraints,
        openKeypad,
        closeKeypad,
        updateValue,
        submitValue,
      }}
    >
      {children}
    </NumericKeypadContext.Provider>
  );
}

export function useNumericKeypad() {
  const context = useContext(NumericKeypadContext);
  if (!context) {
    throw new Error('useNumericKeypad must be used within NumericKeypadProvider');
  }
  return context;
}
