terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
  }
}

provider "google" {
  credentials = file("C:/Users/mohim/Downloads/chrome-orb-445506-j9-345a3c8d454b.json")
  project     = "chrome-orb-445506-j9"
  region      = "asia-south2"  
}

data "google_project" "verify" {
  project_id = "chrome-orb-445506-j9"
}

output "project_number" {
  value = "Project Number: ${data.google_project.verify.number}"
}
