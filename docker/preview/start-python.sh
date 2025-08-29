#!/bin/bash
#
# Python Start Script

set -e

echo "Starting Python preview container..."

# Install dependencies if requirements.txt exists
if [ -f "requirements.txt" ]; then
    if [ ! -f ".requirements_installed" ] || [ "requirements.txt" -nt ".requirements_installed" ]; then
        echo "Installing Python dependencies..."
        pip install --user --no-cache-dir -r requirements.txt
        touch .requirements_installed
    fi
fi

# Set port
export PORT=${PORT:-8000}

# Detect project type and start appropriately
echo "Detecting Python web framework..."

# Check for Django
if [ -f "manage.py" ] || find . -name "settings.py" -o -name "django_settings.py" | head -1 | grep -q .; then
    echo "Detected Django application"
    
    # Run migrations if manage.py exists
    if [ -f "manage.py" ]; then
        echo "Running Django migrations..."
        python manage.py migrate --noinput || echo "Migration failed, continuing..."
        
        echo "Starting Django development server..."
        exec python manage.py runserver 0.0.0.0:$PORT
    else
        # Try to find and run Django app directly
        echo "No manage.py found, trying to start Django directly..."
        exec python -m django runserver 0.0.0.0:$PORT
    fi

# Check for Flask
elif grep -r "Flask" . --include="*.py" | head -1 | grep -q "Flask" || [ -f "app.py" ]; then
    echo "Detected Flask application"
    
    # Look for common Flask entry points
    if [ -f "app.py" ]; then
        echo "Starting Flask app from app.py..."
        export FLASK_APP=app.py
        exec flask run --host=0.0.0.0 --port=$PORT
    elif [ -f "main.py" ]; then
        echo "Starting Flask app from main.py..."
        export FLASK_APP=main.py
        exec flask run --host=0.0.0.0 --port=$PORT
    elif [ -f "server.py" ]; then
        echo "Starting Flask app from server.py..."
        export FLASK_APP=server.py
        exec flask run --host=0.0.0.0 --port=$PORT
    else
        echo "Running Python directly (Flask app)..."
        exec python app.py
    fi

# Check for FastAPI
elif grep -r "FastAPI" . --include="*.py" | head -1 | grep -q "FastAPI"; then
    echo "Detected FastAPI application"
    
    # Look for common FastAPI entry points
    if [ -f "main.py" ]; then
        echo "Starting FastAPI from main.py..."
        exec uvicorn main:app --host 0.0.0.0 --port $PORT --reload
    elif [ -f "app.py" ]; then
        echo "Starting FastAPI from app.py..."
        exec uvicorn app:app --host 0.0.0.0 --port $PORT --reload
    else
        echo "FastAPI detected but no standard entry point found"
        exec python main.py
    fi

# Check for other common Python web servers
elif [ -f "wsgi.py" ]; then
    echo "Detected WSGI application"
    exec gunicorn --bind 0.0.0.0:$PORT wsgi:application

elif [ -f "asgi.py" ]; then
    echo "Detected ASGI application"
    exec uvicorn asgi:application --host 0.0.0.0 --port $PORT

# Generic Python application
elif [ -f "main.py" ]; then
    echo "Running main.py..."
    exec python main.py

elif [ -f "app.py" ]; then
    echo "Running app.py..."
    exec python app.py

elif [ -f "server.py" ]; then
    echo "Running server.py..."
    exec python server.py

# Static file server as fallback
else
    echo "No Python web application detected, starting HTTP server..."
    exec python -m http.server $PORT --bind 0.0.0.0
fi