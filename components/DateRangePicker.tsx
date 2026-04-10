"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './DateRangePicker.module.css';

interface DateRangePickerProps {
  onApply: (range: string) => void;
  onApplyDates?: (start: Date, end: Date) => void;
  initialPreset?: string;
}

export default function DateRangePicker({ onApply, onApplyDates, initialPreset = 'اليوم' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preset, setPreset] = useState(initialPreset);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Date States
  const [selectedStartDate, setSelectedStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedEndDate, setSelectedEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const presets = [
    'اليوم',
    'أمس',
    'آخر 7 أيام',
    'آخر 14 يومًا',
    'هذا الشهر',
    'تاريخ مخصص'
  ];

  // Apply preset logic
  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    
    switch (preset) {
      case 'اليوم':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'أمس':
        start.setDate(today.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(today.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'آخر 7 أيام':
        start.setDate(today.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'آخر 14 يومًا':
        start.setDate(today.getDate() - 14);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'هذا الشهر':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'تاريخ مخصص':
        return; // Don't reset if custom
    }
    
    setSelectedStartDate(start);
    setSelectedEndDate(end);
  }, [preset]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApply = () => {
    let output = preset;
    if (preset === 'تاريخ مخصص') {
      output = `${selectedStartDate.toLocaleDateString('en-GB')} - ${selectedEndDate.toLocaleDateString('en-GB')}`;
    }
    onApply(output);
    if (onApplyDates) {
      onApplyDates(selectedStartDate, selectedEndDate);
    }
    setIsOpen(false);
  };

  const getButtonLabel = () => {
    if (preset === 'تاريخ مخصص') {
      return `${selectedStartDate.toLocaleDateString('en-GB')} - ${selectedEndDate.toLocaleDateString('en-GB')}`;
    }
    return `${preset}: ${selectedStartDate.toLocaleDateString('en-GB')}`;
  };

  // Convert Date object to YYYY-MM-DD for input[type="date"]
  const toISODate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (type: 'start' | 'end', val: string) => {
    const newDate = new Date(val);
    if (type === 'start') {
      newDate.setHours(0, 0, 0, 0);
      setSelectedStartDate(newDate);
    } else {
      newDate.setHours(23, 59, 59, 999);
      setSelectedEndDate(newDate);
    }
    setPreset('تاريخ مخصص');
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={styles.triggerButton} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>📅 {getButtonLabel()}</span>
        <span className={styles.arrow}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownContent}>
            
            <div className={styles.mainPanel}>
              <div className={styles.inputsGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.fieldLabel}>من (تاريخ البدء)</label>
                  <input 
                    type="date" 
                    className={styles.dateInputNative} 
                    value={toISODate(selectedStartDate)} 
                    onChange={(e) => handleDateChange('start', e.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.fieldLabel}>إلى (تاريخ الانتهاء)</label>
                  <input 
                    type="date" 
                    className={styles.dateInputNative} 
                    value={toISODate(selectedEndDate)} 
                    onChange={(e) => handleDateChange('end', e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.actionsArea}>
                <button className={styles.updateBtn} onClick={handleApply}>تحديث النطاق</button>
                <button className={styles.cancelBtn} onClick={() => setIsOpen(false)}>إلغاء</button>
                <span className={styles.timezoneText}>توقيت بغداد</span>
              </div>
            </div>

            <div className={styles.presetsPanel}>
              <div className={styles.presetsTitle}>اختصارات سريعة</div>
              <div className={styles.presetList}>
                {presets.map(p => (
                  <label key={p} className={styles.presetItem}>
                    <span className={styles.radioLabel}>{p}</span>
                    <input 
                      type="radio" 
                      name="datePreset" 
                      checked={preset === p} 
                      onChange={() => setPreset(p)} 
                      className={styles.radioInput}
                    />
                  </label>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
