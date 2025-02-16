terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
  }
}

variable "credentials" {}  
variable "project_id" {}
variable "region" {}

provider "google" {
  credentials = var.credentials 
  project     = var.project_id
  region      = var.region
}

data "google_project" "verify" {
  project_id = var.project_id
}

output "project_number" {
  value = "Project Number: ${data.google_project.verify.number}"
}

output "verification_status" {
  value = "Verified! GCP Account has access to Project: ${data.google_project.verify.name} (ID: ${data.google_project.verify.project_id})"
}
