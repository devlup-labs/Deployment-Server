#!/bin/bash

# Define the output file
OUTPUT_FILE="/etc/nginx/conf.d/portal-uat.conf"

# Take input for different routes and ports
read -p "Enter the route and port for API (e.g., /api 9000): " API_ROUTE API_PORT
read -p "Enter the route and port for Frontend (e.g., / 8789): " FRONTEND_ROUTE FRONTEND_PORT
read -p "Enter the route and port for Database (e.g., /db 4574): " DB_ROUTE DB_PORT

# Write the Nginx configuration to the file
cat <<EOF > $OUTPUT_FILE
server {
    listen 80;
    listen [::]:80;
    server_name portal-uat.welcomescreen.com;
    index index.html;

    # Backend API requests
    location $API_ROUTE {
        proxy_pass http://localhost:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Frontend app
    location $FRONTEND_ROUTE {
        proxy_pass http://localhost:$FRONTEND_PORT;
        try_files \$uri \$uri/ /index.html;
    }

    # Database requests
    location $DB_ROUTE {
        proxy_pass http://localhost:$DB_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Open the file in nano for further editing
nano $OUTPUT_FILE

echo "Nginx configuration file created at $OUTPUT_FILE and opened in nano for editing."



# THIS IS THE SECOND FILES WHICH HANDLE THE LOCATION EFFECTIVELY
#!/bin/bash

# Define the output file
OUTPUT_FILE="/etc/nginx/conf.d/portal-uat.conf"

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Nginx is not installed. Please install Nginx first."
    exit 1
fi

# Check if /etc/nginx/conf.d/ exists, create it if not
if [ ! -d "/etc/nginx/conf.d" ]; then
    echo "/etc/nginx/conf.d/ directory does not exist. Creating it..."
    sudo mkdir -p /etc/nginx/conf.d/
fi

# Take input for different routes and ports
read -p "Enter the route and port for API (e.g., /api 9000): " API_ROUTE API_PORT
read -p "Enter the route and port for Frontend (e.g., / 8789): " FRONTEND_ROUTE FRONTEND_PORT
read -p "Enter the route and port for Database (e.g., /db 4574): " DB_ROUTE DB_PORT

# Write the Nginx configuration to the file
cat <<EOF | sudo tee $OUTPUT_FILE > /dev/null
server {
    listen 80;
    listen [::]:80;
    server_name portal-uat.welcomescreen.com;
    index index.html;

    # Backend API requests
    location $API_ROUTE {
        proxy_pass http://localhost:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Frontend app
    location $FRONTEND_ROUTE {
        proxy_pass http://localhost:$FRONTEND_PORT;
        try_files \$uri \$uri/ /index.html;
    }

    # Database requests
    location $DB_ROUTE {
        proxy_pass http://localhost:$DB_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Check if the file was created successfully
if [ -f "$OUTPUT_FILE" ]; then
    echo "Nginx configuration file created at $OUTPUT_FILE"
else
    echo "Failed to create the Nginx configuration file."
    exit 1
fi