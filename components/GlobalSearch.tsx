import React from 'react';
import styles from './GlobalSearch.module.css';

interface GlobalSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilterClick?: () => void;
  className?: string;
  showFilter?: boolean;
}

export default function GlobalSearch({ 
  placeholder = 'بحث...', 
  value, 
  onChange, 
  onFilterClick, 
  className = '',
  showFilter = true
}: GlobalSearchProps) {
  return (
    <div className={`${styles.searchWrapper} ${className}`}>
      <div className={styles.searchInner}>
        <svg className={styles.searchIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          type="text" 
          className={styles.searchInput} 
          placeholder={placeholder} 
          value={value} 
          onChange={onChange} 
        />
        {showFilter && (
          <button type="button" className={styles.filterBtn} onClick={onFilterClick} aria-label="Filters">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
