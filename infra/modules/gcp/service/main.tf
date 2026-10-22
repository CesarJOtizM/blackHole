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
variable "image" { type = string }
variable "network_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "role" { type = string }
variable "environment" { type = string }

locals {
  production    = var.environment == "production"
  min_instances = local.production ? (var.role == "api" ? 2 : 1) : 0
  max_instances = 10
  queue_scaled  = var.role == "worker"
}

resource "google_cloud_run_v2_service" "this" {
  name     = var.name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  labels = {
    public_subnets = tostring(length(var.public_subnet_ids))
    scale          = local.queue_scaled ? "queue" : "cpu"
  }

  template {
    scaling {
      min_instance_count = local.min_instances
      max_instance_count = local.max_instances
    }

    vpc_access {
      network_interfaces {
        network    = var.network_id
        subnetwork = var.private_subnet_ids[0]
      }
    }

    containers {
      image = var.image
      ports {
        container_port = var.role == "api" ? 4310 : 8080
      }
    }
  }
}

output "hostname" { value = google_cloud_run_v2_service.this.uri }
output "min_instances" { value = local.min_instances }
output "max_instances" { value = local.max_instances }
