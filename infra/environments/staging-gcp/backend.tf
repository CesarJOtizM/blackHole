terraform {
  backend "gcs" {
    bucket = "blackhole-staging-gcp-tfstate"
    prefix = "terraform/state"
  }
}
