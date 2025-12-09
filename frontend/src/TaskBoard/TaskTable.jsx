// components/TaskTable.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge'; 

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
};

const TaskTable = ({ tasks, onVectorize, onUpdateStatus }) => {
    const navigate = useNavigate();

    const handleEdit = (taskId) => {
        console.log(`Opening editor for task ${taskId}`);
        navigate(`/editResult/${taskId}`);
    };

    if (tasks.length === 0) {
        return (
            <div className="py-12 text-center">
                <p className="text-gray-500 text-lg">Список задач порожній</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID Ланцюжка</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Дата створення</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Статус процесу</th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Дії</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {tasks.map((task) => {
                        const hasChild = !!task.child_id;
                        
                        const updateId = task.child_id ? `${task.child_id}?post=True` : task.task_id;

                        return (
                            <tr key={task.task_id} className="hover:bg-gray-50 transition-colors duration-150">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                    <div className="flex flex-col items-center">
                                        <span className=" bg-gray-100 px-2 py-1 rounded">#{task.task_id}</span>
                                        {hasChild && (
                                            <>
                                                <span className="mx-2 text-gray-400">👇🏿</span>
                                                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">#{task.child_id}</span>
                                            </>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex flex-col">
                                        <span>{formatDate(task.created_at)}</span>
                                        {hasChild && task.child_created_at && (
                                            <span className="text-xs text-gray-400 mt-1">
                                                Upd: {formatDate(task.child_created_at)}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-col items-start">
                                        <StatusBadge status={task.status} label="Parent" />
                                        {hasChild && (
                                            <StatusBadge status={task.child_status} label="Child" />
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {!hasChild && task.status !== 'ERROR' && task.status !== 'PENDING' && task.status !== 'PROCESSING' && (
                                        <button 
                                            onClick={() => onVectorize(task.task_id)}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none transition mr-2"
                                        >
                                            🚀 Старт
                                        </button>
                                    )}

                                    {(task.status === 'PENDING' || task.child_status === 'PENDING' || task.status === 'PROCESSING') && (
                                        <span className="inline-flex items-center text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100 mr-2">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-ping"></span>
                                            Виконується...
                                        </span>
                                    )}

                                    {task.child_id && task.child_status === 'SUCCESS' && (
                                        <button 
                                            onClick={() => handleEdit(task.child_id)}
                                            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition mr-2"
                                        >
                                            ✏️ Редагувати
                                        </button>
                                    )}

                                    <button 
                                        onClick={() => onUpdateStatus(updateId)} 
                                        className="bg-white px-2 py-1.5 rounded shadow-sm border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition mr-2"
                                        title="Оновити статус цієї задачі"
                                    >
                                        🔄
                                    </button>

                                    {(task.status === 'ERROR' || task.child_status === 'ERROR') && (
                                        <div className="inline-flex items-center gap-2">
                                            <span className="text-red-600 text-xs font-bold">Помилка</span>
                                            <button 
                                                onClick={() => onVectorize(task.task_id)}
                                                className="text-xs text-gray-500 underline hover:text-gray-800"
                                            >
                                                Повторити
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default TaskTable;