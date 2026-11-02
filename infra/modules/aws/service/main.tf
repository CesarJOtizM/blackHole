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
variable "image" { type = string }
variable "network_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "public_subnet_ids" { type = list(string) }
variable "role" { type = string }
variable "environment" { type = string }
variable "collector_endpoint" { type = string }
variable "rollout_percent" {
  type    = number
  default = 100

  validation {
    condition     = var.rollout_percent >= 1 && var.rollout_percent <= 100
    error_message = "rollout_percent must be between 1 and 100."
  }
}

locals {
  production        = var.environment == "production"
  min_instances     = local.production ? (var.role == "api" ? 2 : 1) : 0
  max_instances     = 10
  queue_scaled      = var.role == "worker"
  partial_rollout   = var.rollout_percent < 100
  shifted_instances = local.partial_rollout ? max(1, floor(local.min_instances * var.rollout_percent / 100)) : 0
}

resource "aws_ecs_cluster" "this" {
  name = var.name
}

resource "aws_iam_role" "execution" {
  name = "${var.name}-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  container_definitions = jsonencode([{
    name  = var.role
    image = var.image
    environment = [{
      name  = "OTEL_EXPORTER_OTLP_ENDPOINT"
      value = var.collector_endpoint
    }]
    portMappings = var.role == "api" ? [{ containerPort = 4310, protocol = "tcp" }] : []
  }])
}

data "aws_ecs_task_definition" "active" {
  count           = local.partial_rollout ? 1 : 0
  task_definition = var.name
}

resource "aws_ecs_service" "this" {
  name                               = var.name
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = local.partial_rollout ? try(data.aws_ecs_task_definition.active[0].arn, aws_ecs_task_definition.this.arn) : aws_ecs_task_definition.this.arn
  desired_count                      = local.min_instances
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.private_subnet_ids
    assign_public_ip = false
  }
}

resource "aws_ecs_service" "shift" {
  count                              = local.partial_rollout ? 1 : 0
  name                               = "${var.name}-shift"
  cluster                            = aws_ecs_cluster.this.id
  task_definition                    = aws_ecs_task_definition.this.arn
  desired_count                      = local.shifted_instances
  launch_type                        = "FARGATE"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = var.private_subnet_ids
    assign_public_ip = false
  }
}

resource "aws_lb" "this" {
  count              = var.role == "api" ? 1 : 0
  name               = var.name
  internal           = false
  load_balancer_type = "application"
  subnets            = var.public_subnet_ids
}

resource "aws_appautoscaling_target" "this" {
  max_capacity       = local.max_instances
  min_capacity       = local.min_instances
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "queue_depth" {
  count              = local.queue_scaled ? 1 : 0
  name               = "${var.name}-queue-depth"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 10
    customized_metric_specification {
      metric_name = "pgboss.jobs_waiting"
      namespace   = "Blackhole"
      statistic   = "Average"
    }
  }
}

resource "aws_appautoscaling_policy" "queue_age" {
  count              = local.queue_scaled ? 1 : 0
  name               = "${var.name}-queue-age"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this.resource_id
  scalable_dimension = aws_appautoscaling_target.this.scalable_dimension
  service_namespace  = aws_appautoscaling_target.this.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 30
    customized_metric_specification {
      metric_name = "pgboss.oldest_job_seconds"
      namespace   = "Blackhole"
      statistic   = "Average"
    }
  }
}

output "hostname" {
  value = var.role == "api" ? aws_lb.this[0].dns_name : aws_ecs_service.this.name
}
output "min_instances" { value = local.min_instances }
output "max_instances" { value = local.max_instances }
