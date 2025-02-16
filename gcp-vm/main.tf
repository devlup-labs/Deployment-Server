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
variable "ports" {
  type = list(string)
}
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

  metadata = var.public_key != "" ? { ssh-keys = "${var.public_key}" } : {}
}

resource "google_compute_firewall" "allow_custom_ports" {
  name    = "allow-custom-ports"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = var.ports
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_http" {
  name    = "allow-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80"]
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_https" {
  name    = "allow-https"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
}

output "vm_details" {
  value = "VM '${var.instance_name}' created in ${var.zone} with e2-micro, Ubuntu 22.04 LTS, and balanced disk (10GB). Ports: ${join(", ", var.ports)}. HTTP and HTTPS allowed."
}
