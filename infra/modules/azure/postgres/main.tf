terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "network_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "database_name" { type = string }
variable "high_availability" { type = bool }

locals {
  postgres_extensions = ["pgcrypto", "pg_trgm"]
}

resource "random_password" "database" {
  length  = 32
  special = false
}

resource "azurerm_resource_group" "this" {
  name     = "${var.name}-postgres"
  location = var.region
  tags     = { network = var.network_id }
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                          = var.name
  resource_group_name           = azurerm_resource_group.this.name
  location                      = var.region
  version                       = "16"
  delegated_subnet_id           = var.private_subnet_ids[0]
  public_network_access_enabled = false
  administrator_login           = "blackhole"
  administrator_password        = random_password.database.result
  storage_mb                    = 32768
  sku_name                      = "B_Standard_B1ms"

  dynamic "high_availability" {
    for_each = var.high_availability ? [1] : []
    content {
      mode = "ZoneRedundant"
    }
  }
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.this.id
}

output "postgres_endpoint" { value = azurerm_postgresql_flexible_server.this.fqdn }
