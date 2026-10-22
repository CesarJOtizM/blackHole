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

resource "azurerm_container_registry" "this" {
  name                = replace(var.name, "-", "")
  resource_group_name = azurerm_resource_group.this.name
  location            = var.region
  sku                 = "Basic"
  admin_enabled       = false
}

output "registry_url" { value = azurerm_container_registry.this.login_server }
