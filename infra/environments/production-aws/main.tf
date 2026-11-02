variable "git_ref" { type = string }
variable "rollout_percent" {
  type    = number
  default = 100
}

locals {
  account_id = "222222222222"
  plan_only  = false
}

provider "aws" {
  region              = "us-east-1"
  allowed_account_ids = ["222222222222"]
}

module "network" {
  source = "../../modules/aws/network"
  name   = "production-aws"
  region = "us-east-1"
  cidr   = "10.30.0.0/16"
}

module "registry" {
  source = "../../modules/aws/registry"
  name   = "production-aws"
  region = "us-east-1"
}

module "storage" {
  source = "../../modules/aws/storage"
  name   = "production-aws"
  region = "us-east-1"
}

module "secrets" {
  source = "../../modules/aws/secrets"
  name   = "production-aws"
  region = "us-east-1"
}

module "postgres" {
  source             = "../../modules/aws/postgres"
  name               = "production-aws"
  region             = "us-east-1"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  database_name      = "blackhole"
  high_availability  = true
}

module "collector" {
  source = "../../modules/common/collector"
  name   = "production-aws"
}

module "grafana" {
  source                    = "../../modules/common/grafana"
  prometheus_datasource_uid = "prometheus"
}

module "api" {
  source             = "../../modules/aws/service"
  name               = "production-aws-api"
  region             = "us-east-1"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "api"
  environment        = "production"
  collector_endpoint = module.collector.endpoint
  rollout_percent    = var.rollout_percent
}

module "worker" {
  source             = "../../modules/aws/service"
  name               = "production-aws-worker"
  region             = "us-east-1"
  image              = "${module.registry.registry_url}:${var.git_ref}"
  network_id         = module.network.network_id
  private_subnet_ids = module.network.private_subnet_ids
  public_subnet_ids  = module.network.public_subnet_ids
  role               = "worker"
  environment        = "production"
  collector_endpoint = module.collector.endpoint
  rollout_percent    = var.rollout_percent
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
