terraform {
  backend "azurerm" {
    resource_group_name  = "blackhole-staging-azure-tfstate"
    storage_account_name = "bhstagingazuretf"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
    use_oidc             = true
    use_azuread_auth     = true
  }
}
