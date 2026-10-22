variable "git_ref" { type = string }

locals {
  account_id = "blackhole-production-gcp"
  plan_only  = false
}

provider "google" {
  project = "blackhole-production-gcp"
  region  = "us-central1"
}

module "network" {
  source = "../../modules/gcp/network"
  name   = "production-gcp"
  region = "us-central1"
  cidr   = "10.50.0.0/16"
}

module "registry" {
  source = "../../modules/gcp/registry"
  name   = "production-gcp"
  region = "us-central1"
}

module "storage" {
  source = "../../modules/gcp/storage"
  name   = "production-gcp"
  region = "us-central1"
}

module "secrets" {
  source = "../../modules/gcp/secrets"
  name   = "production-gcp"
  region = "us-central1"
}

module "postgres" {
  source             = "../../modules/gcp/postgres"
  name               = "production-gcp"
  region             = "us-central1"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  database_name      = "blackhole"
  high_availability  = true
}

module "api" {
  source             = "../../modules/gcp/service"
  name               = "production-gcp-api"
  region             = "us-central1"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "api"
  environment        = "production"
}

module "worker" {
  source             = "../../modules/gcp/service"
  name               = "production-gcp-worker"
  region             = "us-central1"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "worker"
  environment        = "production"
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
