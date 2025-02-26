#!/bin/bash


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
CONFIG_DIR=$(dirname "$OUTPUT_FILE")
if [ ! -d "$CONFIG_DIR" ]; then
    echo "Directory $CONFIG_DIR does not exist. Creating it..."
    mkdir -p "$CONFIG_DIR"
fi


# Assign arguments to variables
SERVER_NAME=$1
API_ROUTE=$2
API_PORT=$3
FRONTEND_ROUTE=$4
FRONTEND_PORT=$5
DB_ROUTE=$6
DB_PORT=$7

# Validate that ports are numbers
if ! [[ "$API_PORT" =~ ^[0-9]+$ ]] || ! [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]] || ! [[ "$DB_PORT" =~ ^[0-9]+$ ]]; then
    echo "Error: Ports must be numeric values."
    exit 1
fi

# Define output file dynamically
OUTPUT_FILE="/etc/nginx/conf.d/${SERVER_NAME}.conf"

# Write the Nginx configuration to the file
cat > $OUTPUT_FILE << EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;
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
