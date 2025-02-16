#!/bin/bash

# Define the output file
OUTPUT_FILE="/etc/nginx/conf.d/portal-uat.conf"

# Check if running with sudo privileges
if [ "$EUID" -ne 0 ]; then
  echo "Please run with sudo privileges to write to /etc/nginx/conf.d/"
  exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Nginx is not installed. Please install Nginx first."
    exit 1
fi

# Check if /etc/nginx/conf.d/ exists, create it if not
if [ ! -d "/etc/nginx/conf.d" ]; then
    echo "/etc/nginx/conf.d/ directory does not exist. Creating it..."
    mkdir -p /etc/nginx/conf.d/
fi

# Take input for different routes and ports
read -p "Enter the route and port for API (e.g., /api 9000): " API_ROUTE API_PORT
read -p "Enter the route and port for Frontend (e.g., / 8789): " FRONTEND_ROUTE FRONTEND_PORT
read -p "Enter the route and port for Database (e.g., /db 4574): " DB_ROUTE DB_PORT


# Validate that ports are numbers
if ! [[ "$API_PORT" =~ ^[0-9]+$ ]] || ! [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || ! [[ "$DB_PORT" =~ ^[0-9]+$ ]]; then
    echo "Error: Ports must be numeric values."
    exit 1
fi

# Write the Nginx configuration to the file
cat > $OUTPUT_FILE << EOF
server {
    listen 80;
    listen [::]:80;
    server_name portal-uat.deploy.com;
    index index.html;

    # Backend API requests
    location $API_ROUTE {
        proxy_pass http://localhost:$API_PORT;
        proxy_set_header Host \$host;
    }

    # Frontend app
    location $FRONTEND_ROUTE {
        proxy_pass http://localhost:$FRONTEND_PORT;
        try_files \$uri \$uri/ /index.html;
    }

    # Database requests
    location $DB_ROUTE {
        proxy_pass http://localhost:$DB_PORT;

    }
}
EOF

# Check if the file was created successfully
if [ ! -f "$OUTPUT_FILE" ]; then
    echo "Failed to create the Nginx configuration file."
    exit 1
fi

echo "Nginx configuration created at $OUTPUT_FILE"
