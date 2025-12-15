import axios from 'axios';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TaskTable from './TaskTable'; 

const API_URL = import.meta.env.VITE_API_URL;

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
    };

    const handleVectorize = async (taskId) => {
        try {
            console.log(`Sending task ${taskId} to worker...`);

            setTasks(prev => prev.map(t => 
                t.task_id === taskId ? { ...t, status: 'PENDING' } : t
            ));

            await axios.post(`${API_URL}/vec-by-task/${taskId}`);
            
        } catch (err) {
            console.error(err);
            alert("Помилка запуску векторизації");
            fetchTasks(); 
        }
    };

    useEffect(() => {
        fetchTasks();
        intervalRef.current = setInterval(fetchTasks, 10000); 

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

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
                            className="bg-emerald-500 px-4 py-2 rounded-md shadow-sm border border-gray-300 text-sm text-white hover:bg-emerald-600 transition"
                        >
                            Додати нову задачу
                        </button>
                    </div>
                </div>

                <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
                    <TaskTable 
                        tasks={tasks} 
                        onVectorize={handleVectorize}
                        onUpdateStatus={updateOneTask}
                    />
                </div>
            </div>
        </div>
    );
};

export default TaskDashboard;