import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SurfaceSearchProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

export function SurfaceSearch({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
}: SurfaceSearchProps) {
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onSearchRef.current(next);
      }, debounceMs);
    },
    [debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      {/* Search icon */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 'var(--cc-space-3)',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 'var(--cc-font-sm)',
          color: 'var(--cc-text-muted)',
          pointerEvents: 'none',
          lineHeight: 1,
        }}
      >
        🔍
      </span>

      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        data-testid="surface-search-input"
        style={{
          width: '100%',
          height: 34,
          padding: '0 var(--cc-space-3) 0 var(--cc-space-8)',
          border: '1px solid var(--cc-border)',
          borderRadius: 'var(--cc-radius-sm)',
          background: 'var(--cc-surface)',
          color: 'var(--cc-text)',
          fontSize: 'var(--cc-font-sm)',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color var(--cc-duration-fast) var(--cc-ease-standard), box-shadow var(--cc-duration-fast) var(--cc-ease-standard)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--cc-brand)';
          e.currentTarget.style.boxShadow = `0 0 0 2px var(--cc-brand-soft)`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--cc-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}
