variable "git_ref" { type = string }

locals {
  account_id = "22222222-2222-2222-2222-222222222222"
  plan_only  = true
}

provider "azurerm" {
  features {}
  subscription_id = "22222222-2222-2222-2222-222222222222"
  use_oidc        = true
}

module "network" {
  source = "../../modules/azure/network"
  name   = "production-azure"
  region = "eastus"
  cidr   = "10.70.0.0/16"
}

module "registry" {
  source = "../../modules/azure/registry"
  name   = "production-azure"
  region = "eastus"
}

module "storage" {
  source = "../../modules/azure/storage"
  name   = "production-azure"
  region = "eastus"
}

module "secrets" {
  source = "../../modules/azure/secrets"
  name   = "production-azure"
  region = "eastus"
}

module "postgres" {
  source             = "../../modules/azure/postgres"
  name               = "production-azure"
  region             = "eastus"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  database_name      = "blackhole"
  high_availability  = true
}

module "collector" {
  source = "../../modules/common/collector"
  name   = "production-azure"
}

module "grafana" {
  source                    = "../../modules/common/grafana"
  prometheus_datasource_uid = "prometheus"
}

module "api" {
  source             = "../../modules/azure/service"
  name               = "production-azure-api"
  region             = "eastus"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "api"
  environment        = "production"
  collector_endpoint = module.collector.endpoint
}

module "worker" {
  source             = "../../modules/azure/service"
  name               = "production-azure-worker"
  region             = "eastus"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "worker"
  environment        = "production"
  collector_endpoint = module.collector.endpoint
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
