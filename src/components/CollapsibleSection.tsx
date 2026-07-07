import React, { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  description?: string;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  children, 
  defaultOpen = true, 
  actions, 
  description,
  isOpen: controlledIsOpen,
  onToggle
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  
  const handleToggle = () => {
    if (onToggle) {
      onToggle(!isOpen);
    } else {
      setInternalIsOpen(!isOpen);
    }
  };

  const titleText = title || 'Section';
  const titleId = `collapsible-title-${titleText.replace(/\s+/g, '-')}`;
  const contentId = `collapsible-content-${titleText.replace(/\s+/g, '-')}`;

  return (
    <section 
        className="bento-card"
        aria-labelledby={titleId}
    >
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1 mr-4">
            <h2 id={titleId} className="text-lg font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
            {description && isOpen && (
              <p className="mt-1 text-sm text-slate-500 leading-relaxed w-full">
                {description}
              </p>
            )}
          </div>
          <div className="flex-shrink-0">
            <button
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={handleToggle}
              aria-expanded={isOpen}
              aria-controls={contentId}
            >
              <svg
                className={`w-5 h-5 transition-transform duration-300 text-slate-400 ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div
        id={contentId}
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
            <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
              {/* Actions are now rendered here, so they collapse with the content */}
              {actions && <div className="mt-4 mb-4" onClick={(e) => e.stopPropagation()}>{actions}</div>}
              {children}
            </div>
        </div>
      </div>
    </section>
  );
};

export default CollapsibleSection;