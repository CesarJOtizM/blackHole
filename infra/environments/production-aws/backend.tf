terraform {
  backend "s3" {
    bucket         = "blackhole-production-aws-tfstate"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "blackhole-production-aws-tflock"
    encrypt        = true
  }
}
