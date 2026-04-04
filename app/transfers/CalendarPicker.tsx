"use client";

import React, { useState } from 'react';
import styles from './Calendar.module.css';

interface CalendarProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

export default function CalendarPicker({ selectedDate, onSelect, onClose }: CalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const hanglePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  const days = [];
  // Fill empty slots for start of month
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
  }

  // Fill actual days
  for (let d = 1; d <= totalDays; d++) {
    const isSelected = 
      selectedDate.getDate() === d && 
      selectedDate.getMonth() === month && 
      selectedDate.getFullYear() === year;

    days.push(
      <div 
        key={d} 
        className={`${styles.day} ${isSelected ? styles.selectedDay : ''}`}
        onClick={() => {
          onSelect(new Date(year, month, d));
          onClose();
        }}
      >
        {d}
      </div>
    );
  }

  const selectToday = () => {
    onSelect(new Date());
    onClose();
  };

  const selectYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    onSelect(yesterday);
    onClose();
  };

  return (
    <div className={styles.calendarOverlay} onClick={onClose}>
      <div className={styles.calendarContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <button onClick={hanglePrevMonth} className={styles.navBtn}>⟨</button>
          <span className={styles.monthTitle}>{year}(شهر{month + 1})</span>
          <button onClick={handleNextMonth} className={styles.navBtn}>⟩</button>
        </div>

        <div className={styles.daysOfWeek}>
          {daysOfWeek.map(d => <div key={d} className={styles.weekdayLabel}>{d}</div>)}
        </div>

        <div className={styles.daysGrid}>
          {days}
        </div>

        <div className={styles.footer}>
          <button onClick={selectYesterday} className={styles.footerBtn}>أمس</button>
          <button onClick={selectToday} className={styles.footerBtn}>اليوم</button>
        </div>
      </div>
    </div>
  );
}
