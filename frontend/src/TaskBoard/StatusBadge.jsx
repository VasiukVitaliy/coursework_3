import React from 'react';

const StatusBadge = ({ status, label }) => {
    if (!status) return null;

    const baseClasses = "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border";
    
    const colorClasses = {
        'PENDING': "bg-blue-50 text-blue-700 border-blue-200 animate-pulse", 
        'PROCESSING': "bg-blue-50 text-blue-700 border-blue-200 animate-pulse", 
        'SUCCESS': "bg-emerald-50 text-emerald-700 border-emerald-200", 
        'ERROR': "bg-red-50 text-red-700 border-red-200" 
    };

    const statusClass = colorClasses[status] || "bg-gray-50 text-gray-600 border-gray-200"; 

    return (
        <div className="flex items-center gap-2 mb-1 last:mb-0">
            <span className="text-[10px] text-gray-400 w-12 text-right">{label}:</span>
            <span className={`${baseClasses} ${statusClass}`}>
                {status}
            </span>
        </div>
    );
};

export default StatusBadge;