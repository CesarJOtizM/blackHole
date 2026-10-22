variable "git_ref" { type = string }

locals {
  account_id = "11111111-1111-1111-1111-111111111111"
  plan_only  = true
}

provider "azurerm" {
  features {}
  subscription_id = "11111111-1111-1111-1111-111111111111"
  use_oidc        = true
}

module "network" {
  source = "../../modules/azure/network"
  name   = "staging-azure"
  region = "eastus"
  cidr   = "10.60.0.0/16"
}

module "registry" {
  source = "../../modules/azure/registry"
  name   = "staging-azure"
  region = "eastus"
}

module "storage" {
  source = "../../modules/azure/storage"
  name   = "staging-azure"
  region = "eastus"
}

module "secrets" {
  source = "../../modules/azure/secrets"
  name   = "staging-azure"
  region = "eastus"
}

module "postgres" {
  source             = "../../modules/azure/postgres"
  name               = "staging-azure"
  region             = "eastus"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  database_name      = "blackhole"
  high_availability  = false
}

module "api" {
  source             = "../../modules/azure/service"
  name               = "staging-azure-api"
  region             = "eastus"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "api"
  environment        = "staging"
}

module "worker" {
  source             = "../../modules/azure/service"
  name               = "staging-azure-worker"
  region             = "eastus"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "worker"
  environment        = "staging"
}

module "dns" {
  source  = "../../modules/common/dns"
  zone_id = "blackhole-zone"
  records = [{
    name    = "api"
    type    = "CNAME"
    content = module.api.hostname
  }]
}

output "api_hostname" { value = module.api.hostname }
output "registry_url" { value = module.registry.registry_url }
output "storage_bucket" { value = module.storage.storage_bucket }
output "static_bucket" { value = module.storage.static_bucket }
output "secrets_prefix" { value = module.secrets.secrets_prefix }
output "postgres_endpoint" { value = module.postgres.postgres_endpoint }
output "backup_bucket" { value = module.storage.backup_bucket }
