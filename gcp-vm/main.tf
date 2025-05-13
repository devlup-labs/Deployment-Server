terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0.0"
    }
  }
}

variable "credentials" {
  description = "GCP service account credentials JSON string"
  type        = string
  sensitive   = true
}

variable "project_id" {} 
variable "region" {}
variable "zone" {}
variable "instance_name" {}
variable "public_key" {
  type    = string
  default = ""
}

provider "google" {
  credentials = var.credentials
  project     = var.project_id
  region      = var.region
}

resource "google_compute_instance" "vm_instance" {
  name         = var.instance_name
  machine_type = "e2-micro"
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      type  = "pd-balanced"
      size  = 10
    }
  }

  network_interface {
    network       = "default"
    access_config {}
  }

  metadata = {
  ssh-keys = "ubuntu:${var.public_key}"
}
tags = ["web-server"]  
}

resource "google_compute_firewall" "allow_http" {
  name    = "allow-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
}

resource "google_compute_firewall" "allow_https" {
  name    = "allow-https"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web-server"]
}

output "vm_ip" {
  value = google_compute_instance.vm_instance.network_interface[0].access_config[0].nat_ip
}

output "vm_details" {
  value = "VM '${var.instance_name}' created in ${var.zone} with e2-micro, Ubuntu 22.04 LTS, and balanced disk (10GB)"
}
