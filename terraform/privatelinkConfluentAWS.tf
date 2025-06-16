terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas",
      version = "1.36.0"
    }
    confluent = {
      source  = "confluentinc/confluent"
      version = "2.24.0"
    }
  }
}

provider "confluent" {
  cloud_api_key    = "..."    # USING 
  cloud_api_secret = "..." # optionally use CONFLUENT_CLOUD_API_SECRET env var
}

provider "mongodbatlas" {
  public_key = "..."
  private_key  = "..."
}

resource "confluent_environment" "staging" {
  display_name = "joepltf"
}

resource "confluent_network" "private_link" {
  display_name     = "terraform-test-private-link-network-manual"
  cloud            = "AWS"
  region           = "us-east-1"
  connection_types = ["PRIVATELINK"]
  environment {
    id = confluent_environment.staging.id
  }
  dns_config {
    resolution = "PRIVATE"
  }
}

data "mongodbatlas_stream_account_details" "account_details" {
  project_id     = "...."
  cloud_provider = "aws"
  region_name    = "US_EAST_1"
}

resource "confluent_private_link_access" "aws" {
  display_name = "example-private-link-access"
  aws {
    account = data.mongodbatlas_stream_account_details.account_details.aws_account_id
  }
  environment {
    id = confluent_environment.staging.id
  }
  network {
    id = confluent_network.private_link.id
  }
}

resource "confluent_kafka_cluster" "dedicated" {
  display_name = "example-dedicated-cluster"
  availability = "MULTI_ZONE"
  cloud        = confluent_network.private_link.cloud
  region       = confluent_network.private_link.region
  dedicated {
    cku = 2
  }
  environment {
    id = confluent_environment.staging.id
  }
  network {
    id = confluent_network.private_link.id
  }
}

data "confluent_network" "networkstuff" {
  environment {
    id = confluent_environment.staging.id
  }
  display_name = confluent_network.private_link.display_name
}

output "pldns" {
  value = data.confluent_network.networkstuff.dns_domain
}

output "plsubdns" {
  value = data.confluent_network.networkstuff.zonal_subdomains
}


resource "mongodbatlas_stream_privatelink_endpoint" "test" {
  project_id          = "...."
  dns_domain          = confluent_network.private_link.dns_domain
  provider_name       = "AWS"
  region              = "us-east-1"
  vendor              = "CONFLUENT"
  service_endpoint_id = confluent_network.private_link.aws[0].private_link_endpoint_service
  dns_sub_domain      = values(confluent_network.private_link.zonal_subdomains)
}

data "mongodbatlas_stream_privatelink_endpoint" "singular_datasource" {
  project_id = "...."
  id         = mongodbatlas_stream_privatelink_endpoint.test.id
}

output "interface_endpoint_id" {
  value = data.mongodbatlas_stream_privatelink_endpoint.singular_datasource.interface_endpoint_id
}

# Outputs the Atlas-side AWS account ID (derived from interface endpoint data) which can/should be
# used as input to configure Confluent-side network access
output "mongodbatlas_stream_confluent_cloud_ckc_privatelink_aws_account_id" {
  value = data.mongodbatlas_stream_privatelink_endpoint.singular_datasource.provider_account_id
}

output "aws_account_id" {
  value = data.mongodbatlas_stream_account_details.account_details.aws_account_id
}

output "cidr_block" {
  value = data.mongodbatlas_stream_account_details.account_details.cidr_block
}

output "cloud_provider" {
  value = data.mongodbatlas_stream_account_details.account_details.cloud_provider
}

output "vpc_id" {
  value = data.mongodbatlas_stream_account_details.account_details.vpc_id
}
