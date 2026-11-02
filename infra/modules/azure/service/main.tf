terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
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
  production    = var.environment == "production"
  min_instances = local.production ? (var.role == "api" ? 2 : 1) : 0
  max_instances = 10
  queue_scaled  = var.role == "worker"
}

resource "azurerm_resource_group" "this" {
  name     = var.name
  location = var.region
  tags = {
    network        = var.network_id
    public_subnets = join(",", var.public_subnet_ids)
  }
}

resource "azurerm_container_app_environment" "this" {
  name                     = var.name
  location                 = var.region
  resource_group_name      = azurerm_resource_group.this.name
  infrastructure_subnet_id = var.private_subnet_ids[0]
}

resource "azurerm_container_app" "this" {
  name                         = var.name
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = azurerm_resource_group.this.name
  revision_mode                = "Single"

  template {
    min_replicas = local.min_instances
    max_replicas = local.max_instances

    container {
      name   = var.role
      image  = var.image
      cpu    = 0.5
      memory = "1Gi"
      env {
        name  = "OTEL_EXPORTER_OTLP_ENDPOINT"
        value = var.collector_endpoint
      }
    }

    dynamic "custom_scale_rule" {
      for_each = local.queue_scaled ? ["pgboss.jobs_waiting", "pgboss.oldest_job_seconds"] : []
      content {
        name             = custom_scale_rule.value
        custom_rule_type = "postgresql"
        metadata = {
          query            = custom_scale_rule.value
          targetQueryValue = custom_scale_rule.value == "pgboss.jobs_waiting" ? "10" : "30"
        }
      }
    }
  }

  dynamic "ingress" {
    for_each = var.role == "api" ? [1] : []
    content {
      external_enabled = true
      target_port      = 4310
      traffic_weight {
        latest_revision = true
        percentage      = var.rollout_percent
      }
    }
  }
}

output "hostname" {
  value = var.role == "api" ? azurerm_container_app.this.ingress[0].fqdn : azurerm_container_app.this.name
}
output "min_instances" { value = local.min_instances }
output "max_instances" { value = local.max_instances }
