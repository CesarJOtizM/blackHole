terraform {
  required_version = ">= 1.6.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "zone_id" { type = string }

variable "records" {
  type = list(object({
    name    = string
    type    = string
    content = string
  }))
}

resource "cloudflare_record" "this" {
  for_each = { for record in var.records : "${record.name}-${record.type}" => record }
  zone_id  = var.zone_id
  name     = each.value.name
  type     = each.value.type
  content  = each.value.content
}
