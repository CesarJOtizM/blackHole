terraform {
  backend "gcs" {
    bucket = "blackhole-production-gcp-tfstate"
    prefix = "terraform/state"
  }
}
