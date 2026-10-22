terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "cidr" { type = string }

resource "google_compute_network" "this" {
  name                    = var.name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  count                    = 2
  name                     = "${var.name}-private-${count.index}"
  ip_cidr_range            = cidrsubnet(var.cidr, 4, count.index + 2)
  region                   = var.region
  network                  = google_compute_network.this.id
  private_ip_google_access = true
}

resource "google_compute_subnetwork" "public" {
  count         = 2
  name          = "${var.name}-public-${count.index}"
  ip_cidr_range = cidrsubnet(var.cidr, 4, count.index)
  region        = var.region
  network       = google_compute_network.this.id
}

output "network_id" { value = google_compute_network.this.id }
output "private_subnet_ids" { value = google_compute_subnetwork.private[*].id }
output "public_subnet_ids" { value = google_compute_subnetwork.public[*].id }
