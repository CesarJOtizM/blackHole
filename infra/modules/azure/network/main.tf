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
variable "cidr" { type = string }

resource "azurerm_resource_group" "this" {
  name     = var.name
  location = var.region
}

resource "azurerm_virtual_network" "this" {
  name                = var.name
  location            = var.region
  resource_group_name = azurerm_resource_group.this.name
  address_space       = [var.cidr]
}

resource "azurerm_subnet" "private" {
  count                = 2
  name                 = "${var.name}-private-${count.index}"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [cidrsubnet(var.cidr, 4, count.index + 2)]

  dynamic "delegation" {
    for_each = count.index == 0 ? [1] : []
    content {
      name = "postgres"
      service_delegation {
        name = "Microsoft.DBforPostgreSQL/flexibleServers"
        actions = [
          "Microsoft.Network/virtualNetworks/subnets/join/action",
        ]
      }
    }
  }
}

resource "azurerm_subnet" "public" {
  count                = 2
  name                 = "${var.name}-public-${count.index}"
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [cidrsubnet(var.cidr, 4, count.index)]
}

output "network_id" { value = azurerm_virtual_network.this.id }
output "private_subnet_ids" { value = azurerm_subnet.private[*].id }
output "public_subnet_ids" { value = azurerm_subnet.public[*].id }
