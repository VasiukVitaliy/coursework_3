// MapControls.js
import React from 'react';

const MapControls = ({ activeTool, onToolClick, onSave }) => {
    return (
        <aside className="w-80 bg-white flex flex-col border-r border-gray-200 shadow-xl z-10">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">Road Editor</h2>
            </div>
            <div className="p-4 space-y-3">
                <button 
                    onClick={() => onToolClick('draw_line')} 
                    className={`w-full py-3 px-4 rounded-lg border font-bold flex items-center gap-3 ${activeTool === 'draw_line' ? 'bg-blue-100 text-blue-700 border-blue-500' : 'bg-white'}`}
                >
                    ✏️ Малювати
                </button>
                <button 
                    onClick={() => onToolClick('edit')} 
                    className={`w-full py-3 px-4 rounded-lg border font-bold flex items-center gap-3 ${activeTool === 'edit' ? 'bg-blue-100 text-blue-700 border-blue-500' : 'bg-white'}`}
                >
                    ✋ Вибір / Стоп
                </button>
                <button 
                    onClick={() => onToolClick('delete')} 
                    className="w-full py-3 px-4 rounded-lg border font-bold flex items-center gap-3 bg-white text-red-600 border-red-200 hover:bg-red-50"
                >
                    🗑️ Видалити
                </button>
                
                <div className="mt-4 pt-4 border-t">
                    <button onClick={onSave} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">
                        💾 Зберегти JSON
                    </button>
                </div>
                
            </div>
        </aside>
    );
};

export default MapControls;