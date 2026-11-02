variable "git_ref" { type = string }

locals {
  account_id = "111111111111"
  plan_only  = false
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = ["111111111111"]
}

module "network" {
  source = "../../modules/aws/network"
  name   = "staging-aws"
  region = "us-east-1"
  cidr   = "10.20.0.0/16"
}

module "registry" {
  source = "../../modules/aws/registry"
  name   = "staging-aws"
  region = "us-east-1"
}

module "storage" {
  source = "../../modules/aws/storage"
  name   = "staging-aws"
  region = "us-east-1"
}

module "secrets" {
  source = "../../modules/aws/secrets"
  name   = "staging-aws"
  region = "us-east-1"
}

module "postgres" {
  source             = "../../modules/aws/postgres"
  name               = "staging-aws"
  region             = "us-east-1"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  database_name      = "blackhole"
  high_availability  = false
}

module "collector" {
  source = "../../modules/common/collector"
  name   = "staging-aws"
}

module "grafana" {
  source                    = "../../modules/common/grafana"
  prometheus_datasource_uid = "prometheus"
}

module "api" {
  source             = "../../modules/aws/service"
  name               = "staging-aws-api"
  region             = "us-east-1"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "api"
  environment        = "staging"
  collector_endpoint = module.collector.endpoint
}

module "worker" {
  source             = "../../modules/aws/service"
  name               = "staging-aws-worker"
  region             = "us-east-1"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "worker"
  environment        = "staging"
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
