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

resource "azurerm_resource_group" "this" {
  name     = var.name
  location = var.region
}

resource "azurerm_storage_account" "this" {
  name                              = replace(var.name, "-", "")
  resource_group_name               = azurerm_resource_group.this.name
  location                          = var.region
  account_tier                      = "Standard"
  account_replication_type          = "LRS"
  min_tls_version                   = "TLS1_2"
  infrastructure_encryption_enabled = true
}

resource "azurerm_storage_container" "files" {
  name                  = "files"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "static" {
  name                  = "static"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "blob"
}

resource "azurerm_storage_container" "backup" {
  name                  = "backup"
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = "private"
}

output "storage_bucket" { value = azurerm_storage_container.files.name }
output "static_bucket" { value = azurerm_storage_container.static.name }
output "backup_bucket" { value = azurerm_storage_container.backup.name }
