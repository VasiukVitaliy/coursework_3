import axios from 'axios';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Використовуємо змінну оточення або дефолтне значення
const API_URL = import.meta.env.VITE_BACKEND || 'http://localhost:8000';

const TaskDashboard = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const intervalRef = useRef(null);

    const fetchTasks = async () => {
        try {
            const response = await axios.get(`${API_URL}/tasks/`);
            
            if (Array.isArray(response.data)) {
                setTasks(response.data);
                setError(null);
            } else {
                console.warn("Отримано не масив даних:", response.data);
                setTasks([]);
            }
        } catch (err) {
            console.error("Помилка завантаження:", err);
            setError("Не вдалося отримати список завдань. Перевірте сервер.");
        } finally {
            setLoading(false);
        }
    };

    const updateOneTask = async (taskId) => {
        try {
            console.log(`Оновлення статусу задачі ${taskId}...`);
            await axios.put(`${API_URL}/status/${taskId}`);
            fetchTasks(); 
        } catch (err) {
            console.error("Помилка оновлення статусу задачі:", err);
        }
    }

    useEffect(() => {
        fetchTasks();
        intervalRef.current = setInterval(fetchTasks, 3000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const handleVectorize = async (taskId) => {
        try {
            console.log(`Sending task ${taskId} to worker...`);

            setTasks(prev => prev.map(t => 
                t.task_id === taskId ? { ...t, status: 'PENDING' } : t
            ));
            console.log(`Task ${taskId}`);
            console.log(`${API_URL}/vec-by-task/${taskId}`);
            await axios.post(`${API_URL}/vec-by-task/${taskId}`);
            fetchTasks();
        } catch (err) {
            console.error(err);
            alert("Помилка запуску векторизації");
            fetchTasks();
        }
    };

    const handleEdit = (taskId) => {
        console.log(`Opening editor for task ${taskId}`);
        navigate(`/editResult/${taskId}`);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('uk-UA', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    };

    // Оновлений компонент статусів
    const StatusBadge = ({ status, label }) => {
        if (!status) return null;

        const baseClasses = "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border";
        
        const colorClasses = {
            'PENDING': "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",    // В процесі
            'PROCESSING': "bg-blue-50 text-blue-700 border-blue-200 animate-pulse", // Оптимістичний статус
            'SUCCESS': "bg-emerald-50 text-emerald-700 border-emerald-200",         // Готово
            'ERROR': "bg-red-50 text-red-700 border-red-200"                         // Помилка
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

    if (loading && tasks.length === 0) return (
        <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500 animate-pulse">
            Завантаження даних...
        </div>
    );

    if (error) return (
        <div className="flex justify-center items-center h-screen bg-gray-50">
            <div className="bg-red-50 text-red-600 px-6 py-4 rounded-lg shadow border border-red-200 flex flex-col items-center">
                <span className="text-xl mb-2">⚠️</span>
                <span>{error}</span>
                <button onClick={fetchTasks} className="mt-4 text-sm underline hover:text-red-800">Спробувати ще раз</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                        Панель оновлення доріг
                    </h1>
                    <div className="flex gap-4">
                        <button 
                            onClick={()=>navigate('/addTask')}
                            className="bg-emerald-500 px-4 py-2 rounded-md shadow-sm border border-gray-300 text-sm text-white hover:bg-gray-50 transition"
                        >
                            Додати нову задачу
                        </button>
                    </div>
                </div>

                <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
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

                                    const effectiveStatus = hasChild ? task.child_status : task.status;

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

                                                {!hasChild && task.status !== 'ERROR' && task.status !== 'PENDING' && (
                                                    <button 
                                                        onClick={() => handleVectorize(task.task_id)}
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
                                                        onClick={() => handleEdit(hasChild ? task.child_id : task.task_id)}
                                                        className="inline-flex items-center px-3 py-1.5 border border-transparent rounded shadow-sm text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none transition mr-2"
                                                    >
                                                        ✏️ Редагувати
                                                    </button>
                                                )}

                                                <button 
                                                    onClick={() => updateOneTask(task.child_id? task.child_id + "?post=True" : task.task_id)} 
                                                    className="bg-white px-2 py-1.5 rounded shadow-sm border border-gray-300 text-xs text-gray-600 hover:bg-gray-50 transition mr-2"
                                                    title="Оновити статус цієї задачі"
                                                >
                                                    🔄
                                                </button>

                                                {(task.status === 'ERROR' || task.child_status === 'ERROR') && (
                                                    <div className="inline-flex items-center gap-2">
                                                        <span className="text-red-600 text-xs font-bold">
                                                            Помилка
                                                        </span>
                                                        <button 
                                                            onClick={() => handleVectorize(task.task_id)}
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
                        
                        {tasks.length === 0 && !loading && (
                            <div className="py-12 text-center">
                                <p className="text-gray-500 text-lg">Список задач порожній</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDashboard;