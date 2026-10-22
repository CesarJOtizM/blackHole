terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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

resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "postgres" {
  name   = "${var.name}-postgres"
  vpc_id = var.network_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }
}

resource "aws_db_instance" "this" {
  identifier                 = var.name
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = "db.t4g.micro"
  allocated_storage          = 20
  db_name                    = var.database_name
  username                   = "blackhole"
  password                   = random_password.database.result
  db_subnet_group_name       = aws_db_subnet_group.this.name
  vpc_security_group_ids     = [aws_security_group.postgres.id]
  publicly_accessible        = false
  multi_az                   = var.high_availability
  storage_encrypted          = true
  skip_final_snapshot        = false
  backup_retention_period    = 7
  tags                       = { Region = var.region }
}

output "postgres_endpoint" { value = aws_db_instance.this.address }
