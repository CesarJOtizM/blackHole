terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

variable "name" { type = string }
variable "region" { type = string }
variable "network_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "database_name" { type = string }
variable "high_availability" { type = bool }

locals {
  postgres_extensions = ["pgcrypto", "pg_trgm"]
}

resource "random_password" "database" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "this" {
  name             = var.name
  region           = var.region
  database_version = "POSTGRES_16"

  settings {
    tier              = "db-custom-1-3840"
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = 20

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }

    backup_configuration {
      enabled = true
    }

    user_labels = {
      private_subnets = tostring(length(var.private_subnet_ids))
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "this" {
  name     = var.database_name
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "this" {
  name     = "blackhole"
  instance = google_sql_database_instance.this.name
  password = random_password.database.result
}

output "postgres_endpoint" { value = google_sql_database_instance.this.private_ip_address }
