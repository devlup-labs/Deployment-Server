#!/bin/bash

# Check if correct number of arguments are provided
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
    echo "Usage: $0 <git-username> <repo-name> [PAT-token]"
    echo "PAT-token is optional and only required for private repositories"
    exit 1
fi

# Store arguments in variables
GIT_USERNAME="$1"
REPO_NAME="$2"
PAT_TOKEN="$3"

# Project directory
PROJECT_DIR="/opt/$REPO_NAME"

# Function to check if a command was successful
check_status() {
    if [ $? -eq 0 ]; then
        echo "$1 successful"
    else
        echo "Error: $1 failed"
        exit 1
    fi
}

# Update package list
echo "Updating package list..."
sudo apt-get update
check_status "Package list update"

# Install required packages
echo "Installing required packages..."
sudo apt-get install -y curl apt-transport-https ca-certificates software-properties-common
check_status "Required packages installation"

# Install NGINX
echo "Installing NGINX..."
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
check_status "NGINX installation"

# Create directory for the project
# Create project directory
if [ -d "$PROJECT_DIR" ]; then
    echo "Error: Directory $PROJECT_DIR already exists. Remove it or use a different repository name."
    exit 1
fi

echo "Creating project directory..."
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR
cd $PROJECT_DIR

# Clone the repository
echo "Cloning repository..."
if [ -n "$PAT_TOKEN" ]; then
    # Clone private repository using PAT
    git clone https://oauth2:${PAT_TOKEN}@github.com/${GIT_USERNAME}/${REPO_NAME}.git .
else
    # Clone public repository
    git clone https://github.com/${GIT_USERNAME}/${REPO_NAME}.git .
fi
check_status "Repository cloning"

echo "Setup complete! The repository is cloned at $PROJECT_DIR."