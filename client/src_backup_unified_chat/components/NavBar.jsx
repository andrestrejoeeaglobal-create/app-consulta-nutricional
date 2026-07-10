import React, { useState } from 'react';
import { User, FileText, ClipboardList, Utensils, Activity, FlaskConical, Calendar } from 'lucide-react';

const NavBar = () => {
    const [activeTab, setActiveTab] = useState('User');

    const navItems = [
        { id: 'User', icon: <User size={20} />, label: 'Identidad' },
        { id: 'FileText', icon: <FileText size={20} />, label: 'Historia Clínica' },
        { id: 'ClipboardList', icon: <ClipboardList size={20} />, label: 'Restricciones' },
        { id: 'Utensils', icon: <Utensils size={20} />, label: 'Nutrición' },
        { id: 'Activity', icon: <Activity size={20} />, label: 'Signos Vitales' },
        { id: 'FlaskConical', icon: <FlaskConical size={20} />, label: 'Bioquímicos' },
        { id: 'Calendar', icon: <Calendar size={20} />, label: 'Calendario' }
    ];

    return (
        <div className="w-full bg-white shadow-sm border-b border-gray-200 flex items-center justify-around px-2 py-2">
            {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        title={item.label}
                        className={`flex flex-col items-center justify-center p-3 rounded-t-md transition-all ${isActive
                            ? 'text-[#1C75BC] bg-blue-50 border-b-2 border-[#1C75BC]'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-b-2 border-transparent'
                            }`}
                    >
                        {item.icon}
                    </button>
                );
            })}
        </div>
    );
};

export default NavBar;
