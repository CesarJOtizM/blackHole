terraform {
  required_version = ">= 1.6.0"
  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 4.0"
    }
  }
}

variable "prometheus_datasource_uid" { type = string }

locals {
  invoice_labels  = ["tenant_id", "venue_id", "tax_id", "status"]
  factus_statuses = ["429", "rejected", "server_error"]
  none            = []
  owner           = "blackhole"

  dashboards = {
    site = [
      {
        metric     = "http.server.request.duration"
        expr       = "http_server_request_duration_seconds"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "http.server.requests"
        expr       = "http_server_requests_total"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
    ]
    invoices = [
      {
        metric     = "invoices.pending"
        expr       = "invoices_pending"
        labels     = local.invoice_labels
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "invoices.max_age_seconds"
        expr       = "invoices_max_age_seconds"
        labels     = local.invoice_labels
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "factus.requests"
        expr       = "factus_requests_total"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "factus.responses"
        expr       = "factus_responses_total{status=~\"429|rejected|server_error\"}"
        labels     = ["status"]
        statuses   = local.factus_statuses
        counts     = ""
        attributes = local.none
      },
    ]
    cloud = [
      {
        metric     = "postgres.connections_in_use"
        expr       = "postgres_connections_in_use"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "pgboss.jobs_waiting"
        expr       = "pgboss_jobs_waiting"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "pgboss.oldest_job_seconds"
        expr       = "pgboss_oldest_job_seconds"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "pgboss.jobs_failed"
        expr       = "pgboss_jobs_failed"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = local.none
      },
      {
        metric     = "service.instances"
        expr       = "count(target_info)"
        labels     = local.none
        statuses   = local.none
        counts     = "target_info"
        attributes = local.none
      },
    ]
    deployment = [
      {
        metric     = "deployment.info"
        expr       = "deployment_info"
        labels     = local.none
        statuses   = local.none
        counts     = ""
        attributes = ["service.version"]
      },
    ]
  }

  alarms = {
    availability = {
      metric   = "http.server.requests"
      summary  = "availability under 99.5% this month or silent for 5 minutes"
      action   = "page owner blackhole"
      expr     = "(((sum(increase(http_server_requests_total{status!~\"5..\"}[30d])) / sum(increase(http_server_requests_total[30d]))) < bool 0.995) > 0) or absent_over_time(http_server_requests_total[5m])"
      from     = 2592000
      no_data  = "OK"
      exec_err = "Alerting"
    }
    invoice_age = {
      metric   = "invoices.max_age_seconds"
      summary  = "invoice age over 30 minutes"
      action   = "page owner blackhole and inspect the invoice older than 30 minutes"
      expr     = "max(invoices_max_age_seconds) > bool 1800"
      from     = 600
      no_data  = "OK"
      exec_err = "Error"
    }
    rejections = {
      metric   = "factus.responses"
      summary  = "more than 3 rejections in 10 minutes per tax id"
      action   = "page owner blackhole and inspect rejections for that tax id"
      expr     = "sum by (tax_id) (increase(factus_responses_total{status=\"rejected\"}[10m])) > bool 3"
      from     = 600
      no_data  = "OK"
      exec_err = "Error"
    }
    first_production_sentry_issue = {
      metric   = ""
      summary  = "first production Sentry issue"
      action   = "page owner blackhole and triage the production error never seen before"
      expr     = "max(sentry_issues{environment=\"production\", first_seen=\"true\"}) >= bool 1"
      from     = 600
      no_data  = "OK"
      exec_err = "Error"
    }
  }
}

resource "grafana_folder" "blackhole" {
  title = local.owner
  uid   = local.owner
}

resource "grafana_dashboard" "catalog" {
  for_each = local.dashboards
  folder   = grafana_folder.blackhole.uid
  config_json = jsonencode({
    title = each.key
    uid   = each.key
    panels = [
      for index, panel in each.value : {
        id    = index + 1
        type  = "timeseries"
        title = panel.metric
        targets = [{
          refId      = "A"
          expr       = panel.expr
          metric     = panel.metric
          labels     = panel.labels
          statuses   = panel.statuses
          counts     = panel.counts
          attributes = panel.attributes
        }]
      }
    ]
  })
}

resource "grafana_rule_group" "blackhole" {
  name             = local.owner
  folder_uid       = grafana_folder.blackhole.uid
  interval_seconds = 60

  dynamic "rule" {
    for_each = local.alarms
    content {
      name           = rule.value.summary
      for            = "0s"
      condition      = "B"
      no_data_state  = rule.value.no_data
      exec_err_state = rule.value.exec_err
      labels = {
        owner = local.owner
      }
      annotations = {
        summary = rule.value.summary
        action  = rule.value.action
      }
      data {
        ref_id         = "A"
        query_type     = ""
        datasource_uid = var.prometheus_datasource_uid
        relative_time_range {
          from = rule.value.from
          to   = 0
        }
        model = jsonencode({
          refId  = "A"
          expr   = rule.value.expr
          metric = rule.value.metric
        })
      }
      data {
        ref_id         = "B"
        query_type     = ""
        datasource_uid = "-100"
        relative_time_range {
          from = 0
          to   = 0
        }
        model = jsonencode({
          type       = "classic_conditions"
          refId      = "B"
          datasource = { type = "__expr__", uid = "-100" }
          conditions = [{
            type      = "query"
            query     = { params = ["A"] }
            reducer   = { type = "last", params = [] }
            evaluator = { type = "gt", params = [0] }
            operator  = { type = "and" }
          }]
        })
      }
    }
  }
}

output "dashboards" {
  value = ["site", "invoices", "cloud", "deployment"]
}
