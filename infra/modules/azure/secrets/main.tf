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

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "this" {
  name     = var.name
  location = var.region
}

resource "azurerm_key_vault" "this" {
  name                       = var.name
  location                   = var.region
  resource_group_name        = azurerm_resource_group.this.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = true
  soft_delete_retention_days = 7
}

output "secrets_prefix" { value = azurerm_key_vault.this.vault_uri }
