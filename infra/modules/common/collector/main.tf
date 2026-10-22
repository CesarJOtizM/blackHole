terraform {
  required_version = ">= 1.6.0"
}

variable "name" { type = string }

locals {
  image     = "otel/opentelemetry-collector-contrib:0.163.2"
  endpoint  = "http://${var.name}-collector:4318"
  drop_keys = [
    "authorization",
    "cookie",
    "password",
    "token",
    "secret",
    "name",
    "phone",
    "address",
    "identification",
  ]
  sensitive_key   = "(?i)(^|[._-])(${join("|", local.drop_keys)})($|[._-])"
  bearer          = "(?i)\\bbearer\\s+\\S+"
  assignment      = "(?i)\\b(${join("|", local.drop_keys)})\\b\\s*[:=]\\s*(?:\"[^\"]*\"|'[^']*'|\\S+)"
  phone           = "(?:\\+?57[\\s-]?)?3\\d{2}(?:[\\s.-]?\\d{3})[\\s.-]?\\d{4}"
  dotted_id       = "\\d{1,3}(?:[.\\s]\\d{3}){2,3}"
  digit_run       = "\\b\\d{7,10}\\b"
  delete_keys     = "delete_matching_keys(attributes, \"${local.sensitive_key}\")"
  body_statements = [
    "replace_pattern(body, \"${local.bearer}\", \"[redacted]\")",
    "replace_pattern(body, \"${replace(local.assignment, "\"", "\\\"")}\", \"$1=[redacted]\")",
    "replace_pattern(body, \"${local.phone}\", \"[redacted]\")",
    "replace_pattern(body, \"${local.dotted_id}\", \"[redacted]\")",
    "replace_pattern(body, \"${local.digit_run}\", \"[redacted]\")",
  ]
  config          = jsonencode({
    receivers = {
      otlp = {
        protocols = {
          grpc = { endpoint = "0.0.0.0:4317" }
          http = { endpoint = "0.0.0.0:4318" }
        }
      }
    }
    processors = {
      "attributes/drop_fields" = {
        actions = [for key in local.drop_keys : { key = key, action = "delete" }]
      }
      "transform/keys" = {
        error_mode = "ignore"
        trace_statements = [
          { context = "resource", statements = [local.delete_keys] },
          { context = "span", statements = [local.delete_keys] },
          { context = "spanevent", statements = [local.delete_keys] },
        ]
        metric_statements = [
          { context = "resource", statements = [local.delete_keys] },
          { context = "datapoint", statements = [local.delete_keys] },
        ]
        log_statements = [
          { context = "resource", statements = [local.delete_keys] },
          { context = "log", statements = [local.delete_keys] },
        ]
      }
      "redaction/scrub" = {
        allow_all_keys = true
        blocked_key_patterns = [local.sensitive_key]
        blocked_values = [
          local.bearer,
          local.assignment,
          local.phone,
          local.dotted_id,
          local.digit_run,
        ]
        ignored_keys = ["service.version"]
        summary      = "info"
      }
      "transform/bodies" = {
        error_mode = "ignore"
        log_statements = [
          { context = "log", statements = local.body_statements },
        ]
      }
    }
    exporters = {
      "otlphttp/grafana" = {
        endpoint = "$${env:GRAFANA_OTLP_ENDPOINT}"
      }
    }
    service = {
      pipelines = {
        traces = {
          receivers  = ["otlp"]
          processors = ["attributes/drop_fields", "transform/keys", "redaction/scrub"]
          exporters  = ["otlphttp/grafana"]
        }
        metrics = {
          receivers  = ["otlp"]
          processors = ["attributes/drop_fields", "transform/keys", "redaction/scrub"]
          exporters  = ["otlphttp/grafana"]
        }
        logs = {
          receivers  = ["otlp"]
          processors = ["attributes/drop_fields", "transform/keys", "redaction/scrub", "transform/bodies"]
          exporters  = ["otlphttp/grafana"]
        }
      }
    }
  })
}

check "pinned_collector_image" {
  assert {
    condition     = startswith(local.image, "otel/opentelemetry-collector-contrib:") && !strcontains(local.image, "latest")
    error_message = "The collector image must be a pinned otel/opentelemetry-collector-contrib tag."
  }
}

output "image" { value = local.image }
output "endpoint" { value = local.endpoint }
output "config" { value = local.config }
