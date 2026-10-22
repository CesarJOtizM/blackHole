terraform {
  required_version = ">= 1.6.0"
  required_providers {
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.15"
    }
  }
}

variable "organization" {
  type    = string
  default = "blackhole"
}

variable "team" {
  type    = string
  default = "blackhole"
}

locals {
  plan = "free"
  name = "api-cloud"
}

resource "sentry_project" "api_cloud" {
  organization = var.organization
  teams        = [var.team]
  name         = local.name
  slug         = local.name
  platform     = "node"

  lifecycle {
    precondition {
      condition     = local.plan == "free"
      error_message = "The api-cloud Sentry project stays on the free plan."
    }
  }
}

output "project" { value = sentry_project.api_cloud.slug }
output "plan" { value = local.plan }
