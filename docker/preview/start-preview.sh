#!/bin/bash
# Preview Container Startup Script
# Detects project type and starts appropriate dev server

set -e

echo "🚀 Starting workspace preview..."
cd /app

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect and run appropriate dev server
if [ -f "package.json" ]; then
    echo "📦 Node.js project detected"
    
    # Install dependencies
    if [ -f "package-lock.json" ]; then
        echo "Installing dependencies with npm ci..."
        npm ci
    elif [ -f "yarn.lock" ]; then
        echo "Installing dependencies with yarn..."
        yarn install --frozen-lockfile
    elif [ -f "pnpm-lock.yaml" ]; then
        echo "Installing dependencies with pnpm..."
        pnpm install --frozen-lockfile
    else
        echo "Installing dependencies with npm install..."
        npm install
    fi
    
    # Try to find and run dev script
    if npm run | grep -q "dev"; then
        echo "Starting with npm run dev..."
        exec npm run dev
    elif npm run | grep -q "start"; then
        echo "Starting with npm run start..."
        exec npm run start
    elif [ -f "server.js" ]; then
        echo "Starting with node server.js..."
        exec node server.js
    elif [ -f "index.js" ]; then
        echo "Starting with node index.js..."
        exec node index.js
    elif [ -f "app.js" ]; then
        echo "Starting with node app.js..."
        exec node app.js
    else
        echo "No start script found, starting HTTP server..."
        exec npx http-server -p ${PORT:-3000} --cors
    fi
    
elif [ -f "requirements.txt" ]; then
    echo "🐍 Python project detected"
    
    # Install dependencies
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
    
    # Try to find and run Python app
    if [ -f "app.py" ]; then
        echo "Starting with python app.py..."
        exec python app.py
    elif [ -f "main.py" ]; then
        echo "Starting with python main.py..."
        exec python main.py
    elif [ -f "server.py" ]; then
        echo "Starting with python server.py..."
        exec python server.py
    elif [ -f "manage.py" ]; then
        echo "Starting Django with manage.py..."
        exec python manage.py runserver 0.0.0.0:${PORT:-3000}
    else
        echo "Starting Flask development server..."
        export FLASK_APP=app.py
        exec python -m flask run --host=0.0.0.0 --port=${PORT:-3000}
    fi
    
elif [ -f "Gemfile" ]; then
    echo "💎 Ruby project detected"
    
    # Install dependencies
    echo "Installing Ruby dependencies..."
    bundle install
    
    # Try to run Rails or other Ruby apps
    if [ -f "config.ru" ]; then
        echo "Starting with rackup..."
        exec bundle exec rackup -p ${PORT:-3000} --host 0.0.0.0
    elif [ -f "bin/rails" ]; then
        echo "Starting Rails server..."
        exec bundle exec rails server -p ${PORT:-3000} -b 0.0.0.0
    else
        echo "Starting Ruby app..."
        exec bundle exec ruby app.rb
    fi
    
elif [ -f "index.html" ] || [ -f "index.htm" ]; then
    echo "📄 Static HTML site detected"
    echo "Starting HTTP server..."
    exec npx http-server -p ${PORT:-3000} --cors
    
else
    echo "⚠️ Could not detect project type"
    echo "Starting generic HTTP server..."
    exec npx http-server -p ${PORT:-3000} --cors
fi