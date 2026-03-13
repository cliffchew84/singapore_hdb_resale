import React, { useState, useRef, useEffect, useMemo } from 'react';

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

interface MultiSelectDropdownProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  label: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ options, selectedOptions, onChange, placeholder, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (option: string) => {
    onChange(
      selectedOptions.includes(option)
        ? selectedOptions.filter(o => o !== option)
        : [...selectedOptions, option]
    );
  };

  const filteredOptions = useMemo(() => 
    options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()))
  , [options, searchTerm]);

  const handleSelectAll = () => {
    onChange(options);
  };

  const getButtonLabel = () => {
    if (selectedOptions.length === 0) return placeholder;
    if (selectedOptions.length === 1) return selectedOptions[0];
    if (selectedOptions.length === options.length) return `All ${label}s`;
    return `${selectedOptions.length} ${label}s Selected`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-3 py-2 text-sm text-left border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <span className="text-slate-900 dark:text-slate-100 truncate">{getButtonLabel()}</span>
        <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg z-10">
          <div className="p-2">
            <div className="relative">
                <input
                    type="text"
                    placeholder={`Search ${label}s...`}
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 dark:border-slate-500 rounded-md bg-transparent focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="flex justify-between items-center px-2 py-1 border-b border-t border-slate-200 dark:border-slate-600">
            <button onClick={handleSelectAll} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">Select All</button>
            <button onClick={() => onChange([])} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200">Clear</button>
          </div>
          <ul className="max-h-60 overflow-y-auto p-2">
            {filteredOptions.map(option => (
              <li key={option}>
                <label className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500"
                    checked={selectedOptions.includes(option)}
                    onChange={() => handleToggleOption(option)}
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-200">{option}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;