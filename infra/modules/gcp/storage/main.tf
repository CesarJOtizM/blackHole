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

resource "google_storage_bucket" "files" {
  name                        = "${var.name}-files"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

resource "google_storage_bucket" "static" {
  name                        = "${var.name}-static"
  location                    = var.region
  uniform_bucket_level_access = true
}

resource "google_storage_bucket" "backup" {
  name                        = "${var.name}-backup"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

output "storage_bucket" { value = google_storage_bucket.files.name }
output "static_bucket" { value = google_storage_bucket.static.name }
output "backup_bucket" { value = google_storage_bucket.backup.name }
