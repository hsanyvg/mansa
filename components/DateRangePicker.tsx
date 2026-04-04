"use client";

import React, { useState, useRef, useEffect } from 'react';
import styles from './DateRangePicker.module.css';

interface DateRangePickerProps {
  onApply: (range: string) => void;
  initialPreset?: string;
}

export default function DateRangePicker({ onApply, initialPreset = 'اليوم' }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preset, setPreset] = useState(initialPreset);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calendar States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(new Date()); // Default to today
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(new Date());

  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const years = Array.from({ length: 31 }, (_, i) => 2000 + i);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  // Handle Day Click
  const handleDayClick = (dayStr: string) => {
    const clickedDate = new Date(dayStr);
    
    // Simple logic: if start is set but end is not, set end. Otherwise reset to start.
    if (selectedStartDate && !selectedEndDate) {
      if (clickedDate >= selectedStartDate) {
        setSelectedEndDate(clickedDate);
      } else {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(clickedDate);
      }
      setPreset('تاريخ مخصص');
    } else {
      setSelectedStartDate(clickedDate);
      setSelectedEndDate(null);
      setPreset('تاريخ مخصص');
    }
  };

  const isSelected = (dateStr: string) => {
    const d = new Date(dateStr);
    if (selectedStartDate && selectedEndDate) {
      return d >= selectedStartDate && d <= selectedEndDate;
    }
    if (selectedStartDate) {
      return d.toDateString() === selectedStartDate.toDateString();
    }
    return false;
  };

  const renderCalendar = (baseDate: Date, offsetMonths: number) => {
    const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month); // 0 (Sun) to 6 (Sat)
    
    const blanks = Array.from({ length: firstDay }, (_, i) => (
      <span key={`blank-${i}`} className={styles.emptyDay}></span>
    ));
    
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}T00:00:00`;
      return (
        <span 
          key={dayNum} 
          className={isSelected(dateStr) ? styles.selectedDay : ''}
          onClick={() => handleDayClick(dateStr)}
        >
          {dayNum}
        </span>
      );
    });

    return [...blanks, ...days];
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };
  const presets = [
    'اليوم وأمس',
    'آخر 14 يومًا',
    'أمس',
    'آخر 7 أيام',
    'تاريخ مخصص'
  ];

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
    if (preset === 'تاريخ مخصص' && selectedStartDate && selectedEndDate) {
      output = `${selectedStartDate.toLocaleDateString('ar-EG')} - ${selectedEndDate.toLocaleDateString('ar-EG')}`;
    }
    onApply(output);
    setIsOpen(false);
  };

  const getButtonLabel = () => {
    if (preset === 'تاريخ مخصص' && selectedStartDate && selectedEndDate) {
      return `${selectedStartDate.toLocaleDateString('ar-EG')} - ${selectedEndDate.toLocaleDateString('ar-EG')}`;
    }
    const today = new Date();
    const formatted = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
    return `${preset}: ${formatted}`;
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
            
            {/* Left/Middle Panel: Calendars */}
            <div className={styles.calendarsPanel}>
              <div className={styles.calendarsHeader}>
                
                {/* Left Calendar Header (Next Month in RTL) */}
                <div className={styles.calHeader}>
                  <button className={styles.iconBtn} onClick={() => changeMonth(1)}>&lt;</button>
                  <select 
                    className={styles.calSelect} 
                    value={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).getFullYear()}
                    onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth() + 1, 1))}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select 
                    className={styles.calSelect}
                    value={new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).getMonth()}
                    onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value) - 1, 1))}
                  >
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>

                {/* Right Calendar Header (Current Month in RTL) */}
                <div className={styles.calHeader}>
                  <select 
                    className={styles.calSelect} 
                    value={currentDate.getFullYear()}
                    onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth(), 1))}
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select 
                    className={styles.calSelect}
                    value={currentDate.getMonth()}
                    onChange={(e) => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value), 1))}
                  >
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <button className={styles.iconBtn} onClick={() => changeMonth(-1)}>&gt;</button>
                </div>
              </div>

              <div className={styles.calendarsBody}>
                {/* Left Calendar Grid */}
                <div className={styles.calGrid}>
                  <div className={styles.weekDays}>
                    <span>أحد</span><span>إثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span><span>سبت</span>
                  </div>
                  <div className={styles.days}>
                    {renderCalendar(currentDate, 1)}
                  </div>
                </div>

                {/* Right Calendar Grid */}
                <div className={styles.calGrid}>
                  <div className={styles.weekDays}>
                    <span>أحد</span><span>إثنين</span><span>ثلاثاء</span><span>أربعاء</span><span>خميس</span><span>جمعة</span><span>سبت</span>
                  </div>
                  <div className={styles.days}>
                    {renderCalendar(currentDate, 0)}
                  </div>
                </div>
              </div>

              {/* Bottom Inputs Area */}
              <div className={styles.inputsArea}>
                <div className={styles.compareRow}>
                  <label className={styles.checkboxLabel}>
                    مقارنة
                    <input type="checkbox" />
                  </label>
                </div>
                
                <div className={styles.dateInputsRow}>
                  <input type="text" className={styles.dateInput} value={selectedStartDate ? selectedStartDate.toLocaleDateString('ar-EG') : ''} readOnly />
                  <span className={styles.dash}>-</span>
                  <input type="text" className={styles.dateInput} value={selectedEndDate ? selectedEndDate.toLocaleDateString('ar-EG') : ''} readOnly />
                  <select className={styles.presetSelect} value={preset} onChange={(e) => setPreset(e.target.value)}>
                    <option value="اليوم">اليوم</option>
                    <option value="أمس">أمس</option>
                    <option value="تاريخ مخصص">تاريخ مخصص</option>
                  </select>
                </div>
              </div>

              {/* Actions Area */}
              <div className={styles.actionsArea}>
                <button className={styles.updateBtn} onClick={handleApply}>تحديث</button>
                <button className={styles.cancelBtn} onClick={() => setIsOpen(false)}>إلغاء</button>
                <span className={styles.timezoneText}>تظهر التواريخ حسب توقيت بغداد</span>
              </div>
            </div>

            {/* Right Panel: Presets */}
            <div className={styles.presetsPanel}>
              <div className={styles.presetsTitle}>المستخدمة مؤخرًا</div>
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
