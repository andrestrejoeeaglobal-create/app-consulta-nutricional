import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
const Accordion = ({ title, id, isOpen, onToggle, children, variant = 'default', icon: Icon }) => {
    // Styles based on variant
    const isParent = variant === 'parent';
    const containerClasses = isParent
        ? "border border-tilo-border rounded-2xl overflow-hidden bg-tilo-bg-panel shadow-md transition-all duration-300 mb-4"
        : "border border-tilo-border rounded-2xl overflow-hidden bg-tilo-bg-panel shadow-sm transition-all duration-300";

    const buttonClasses = isParent
        ? "w-full flex items-center justify-between p-5 bg-tilo-bg-base/40 hover:bg-tilo-bg-base/80 transition-colors cursor-pointer"
        : "w-full flex items-center justify-between p-4 bg-tilo-bg-base/20 hover:bg-tilo-bg-base/60 transition-colors cursor-pointer";

    const titleClasses = isParent
        ? "text-base font-extrabold text-tilo-text-main uppercase tracking-widest flex items-center gap-2.5"
        : "text-sm font-bold text-tilo-text-main uppercase tracking-wider flex items-center gap-2";

    const iconClasses = isParent
        ? "w-6 h-6 text-tilo-text-muted"
        : "w-5 h-5 text-tilo-text-muted/70";

    const clinicalIconClasses = isParent
        ? "w-5 h-5 text-tilo-primary"
        : "w-4 h-4 text-tilo-primary";

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
                    {Icon && <Icon className={clinicalIconClasses} />}
                    {title}
                </h3>
                {isOpen ? <ChevronUp className={iconClasses} /> : <ChevronDown className={iconClasses} />}
            </button>

            <div
                id={`content-${id}`}
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-6 border-t border-tilo-border/60">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Accordion;
