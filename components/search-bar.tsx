"use client";

import { useCallback, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search the archives...",
  className = "",
}: SearchBarProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onChange(next), 300);
    },
    [onChange]
  );

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  function handleClear() {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    onChange("");
  }

  return (
    <div className={`relative ${className}`}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
        style={{ color: "var(--text-dim)" }}
      />
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={handleInput}
        placeholder={placeholder}
        className="w-full rounded-md pl-9 pr-9 py-2.5 outline-none transition-all duration-200 sw-search-input"
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 500,
          fontSize: "1rem",
          letterSpacing: "0.5px",
          color: "var(--text-primary)",
          background: "var(--card-bg)",
          border: "1px solid var(--panel-border)",
        }}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: "var(--text-dim)" }}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
