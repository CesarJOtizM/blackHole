terraform {
  backend "azurerm" {
    resource_group_name  = "blackhole-production-azure-tfstate"
    storage_account_name = "bhproductionazuretf"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
    use_oidc             = true
    use_azuread_auth     = true
  }
}
