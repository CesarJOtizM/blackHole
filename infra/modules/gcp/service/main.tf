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
variable "collector_endpoint" { type = string }
variable "rollout_percent" {
  type    = number
  default = 100

  validation {
    condition     = var.rollout_percent >= 1 && var.rollout_percent <= 100
    error_message = "rollout_percent must be between 1 and 100."
  }
}

locals {
  production      = var.environment == "production"
  min_instances   = local.production ? (var.role == "api" ? 2 : 1) : 0
  max_instances   = 10
  queue_scaled    = var.role == "worker"
  partial_rollout = var.rollout_percent < 100
}

data "google_cloud_run_v2_service" "active" {
  count    = local.partial_rollout ? 1 : 0
  name     = var.name
  location = var.region
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
      env {
        name  = "OTEL_EXPORTER_OTLP_ENDPOINT"
        value = var.collector_endpoint
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = var.rollout_percent
  }

  dynamic "traffic" {
    for_each = local.partial_rollout ? [100 - var.rollout_percent] : []
    content {
      type     = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"
      percent  = traffic.value
      revision = try(data.google_cloud_run_v2_service.active[0].latest_ready_revision, var.name)
    }
  }
}

output "hostname" { value = google_cloud_run_v2_service.this.uri }
output "min_instances" { value = local.min_instances }
output "max_instances" { value = local.max_instances }
