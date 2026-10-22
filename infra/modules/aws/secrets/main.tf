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

resource "aws_secretsmanager_secret" "this" {
  name = "${var.name}/"
}

output "secrets_prefix" { value = aws_secretsmanager_secret.this.name }
