terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

variable "name" { type = string }
variable "region" { type = string }

resource "google_secret_manager_secret" "this" {
  secret_id = var.name
  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}

output "secrets_prefix" { value = google_secret_manager_secret.this.name }
