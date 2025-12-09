@echo off
:: Переходимо в папку, де лежить сам скрипт (щоб шляхи працювали коректно при запуску від Адміністратора)
cd /d "%~dp0"

echo Starting Backend...
start "Backend" cmd /k "call venv\Scripts\activate && cd app && uvicorn main:app --reload"

echo Starting Worker Model...
start "Worker_Model" cmd /k "call venv\Scripts\activate && cd app && celery -A model_service worker -P solo --loglevel=info"

echo Starting Worker Post-processing...
start "Worker_Post" cmd /k "call venv\Scripts\activate && cd app && celery -A postprocessing_worker worker -P solo --loglevel=info"

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo All services launched.