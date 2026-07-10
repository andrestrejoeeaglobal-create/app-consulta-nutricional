import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
const Accordion = ({ title, id, isOpen, onToggle, children, variant = 'default' }) => {
    // Styles based on variant
    const isParent = variant === 'parent';
    const containerClasses = isParent
        ? "border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-md transition-all duration-300 mb-4"
        : "border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all duration-300";

    const buttonClasses = isParent
        ? "w-full flex items-center justify-between p-5 bg-slate-100 hover:bg-slate-200 transition-colors"
        : "w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors";

    const titleClasses = isParent
        ? "text-base font-extrabold text-slate-800 uppercase tracking-widest"
        : "text-sm font-bold text-slate-600 uppercase tracking-wider";

    const iconClasses = isParent
        ? "w-6 h-6 text-slate-600"
        : "w-5 h-5 text-slate-400";

    return (
        <div className={containerClasses}>
            <button
                type="button"
                className={buttonClasses}
                onClick={onToggle}
                aria-expanded={isOpen}
                aria-controls={`content-${id}`}
            >
                <h3 className={titleClasses}>
                    {title}
                </h3>
                {isOpen ? <ChevronUp className={iconClasses} /> : <ChevronDown className={iconClasses} />}
            </button>

            <div
                id={`content-${id}`}
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-6 border-t border-slate-100">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Accordion;
