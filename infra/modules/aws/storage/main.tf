terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "name" { type = string }
variable "region" { type = string }

resource "aws_s3_bucket" "files" {
  bucket = "${var.name}-files"
}

resource "aws_s3_bucket" "static" {
  bucket = "${var.name}-static"
}

resource "aws_s3_bucket" "backup" {
  bucket = "${var.name}-backup"
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "backup" {
  bucket                  = aws_s3_bucket.backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "storage_bucket" { value = aws_s3_bucket.files.bucket }
output "static_bucket" { value = aws_s3_bucket.static.bucket }
output "backup_bucket" { value = aws_s3_bucket.backup.bucket }
