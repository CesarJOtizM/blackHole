terraform {
  required_version = ">= 1.6.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

variable "region" { type = string }
variable "subscription_id" { type = string }
variable "github_repository" { type = string }

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
  use_oidc        = true
}

resource "azurerm_resource_group" "state" {
  name     = "blackhole-tfstate"
  location = var.region
}

resource "azurerm_storage_account" "state" {
  name                            = "blackholetfstate"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = var.region
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  infrastructure_encryption_enabled = true
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}

resource "azurerm_user_assigned_identity" "github" {
  name                = "blackhole-github"
  resource_group_name = azurerm_resource_group.state.name
  location            = var.region
}

resource "azurerm_federated_identity_credential" "github" {
  name                = "github"
  resource_group_name = azurerm_resource_group.state.name
  parent_id           = azurerm_user_assigned_identity.github.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = "https://token.actions.githubusercontent.com"
  subject             = "repo:${var.github_repository}:ref:refs/heads/master"
}
