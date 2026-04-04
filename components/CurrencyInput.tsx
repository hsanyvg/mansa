import React, { useState, useEffect } from 'react';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChangeValue: (val: number) => void;
  className?: string;
}

export default function CurrencyInput({ value, onChangeValue, className, style, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // Formats the value with commas on component load or external value changes
    if (value === 0 && displayValue === '') return;
    setDisplayValue(value ? new Intl.NumberFormat('en-US').format(value) : (value === 0 ? '0' : ''));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    if (rawVal === '') {
      onChangeValue(0);
      setDisplayValue('');
      return;
    }
    
    // Convert to number and format with commas
    const numVal = parseInt(rawVal, 10);
    onChangeValue(numVal);
    setDisplayValue(new Intl.NumberFormat('en-US').format(numVal));
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
      <input
        type="text"
        dir="ltr"
        value={displayValue}
        onChange={handleChange}
        className={className}
        style={{ 
          paddingLeft: '45px', 
          textAlign: 'center', 
          width: '100%',
          ...style
        }}
        {...props}
      />
      <span style={{ 
        position: 'absolute', 
        left: '10px', 
        color: '#6c757d', 
        fontSize: '0.9rem', 
        fontWeight: 'bold',
        pointerEvents: 'none' 
      }}>
        د.ع
      </span>
    </div>
  );
}
