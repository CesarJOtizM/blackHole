terraform {
  backend "s3" {
    bucket         = "blackhole-staging-aws-tfstate"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "blackhole-staging-aws-tflock"
    encrypt        = true
  }
}
