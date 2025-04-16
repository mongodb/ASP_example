terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas",
      version = "1.31.0"
    }
    confluent = {
      source  = "confluentinc/confluent"
      version = "2.24.0"
    }
  }
}

provider "confluent" {
  cloud_api_key    = "..."    # USING Cloud resource management access
  cloud_api_secret = "..." 
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

resource "confluent_private_link_access" "aws" {
  display_name = "example-private-link-access"
  aws {
    account = "..." # MONGO AWS ACCOUNT for the specific atlas project and region used https://www.mongodb.com/docs/atlas/reference/api-resources-spec/v2/#tag/Streams/operation/getAccountDetails
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
  project_id          = "..." # Atlas Project ID
  dns_domain          = confluent_network.private_link.dns_domain
  provider_name       = "AWS"
  region              = "us-east-1"
  vendor              = "CONFLUENT"
  service_endpoint_id = confluent_network.private_link.aws[0].private_link_endpoint_service
  dns_sub_domain      = values(confluent_network.private_link.zonal_subdomains)
}

data "mongodbatlas_stream_privatelink_endpoint" "singular_datasource" {
  project_id = "...." # Atlas Project ID
  id         = mongodbatlas_stream_privatelink_endpoint.test.id
}

output "interface_endpoint_id" {
  value = data.mongodbatlas_stream_privatelink_endpoint.singular_datasource.interface_endpoint_id
}

resource "mongodbatlas_stream_instance" "test" {
    project_id = "..." # Atlas Project ID
    instance_name = "JSNTFTESTING"
    data_process_region = {
        region = "VIRGINIA_USA"
        cloud_provider = "AWS"
  }
  stream_config = {
    tier = "SP10"
    }
}

resource "mongodbatlas_stream_connection" "jsncluster0" {
    project_id = "..." # Atlas Project ID
    instance_name = "JSNTFTESTING"
    connection_name = "jsncluster0conn"
    type = "Cluster"
    cluster_name = "jsncluster0"
    db_role_to_execute = {
       type = "BUILT_IN"
       role = "atlasAdmin"
    }
}

resource "mongodbatlas_stream_connection" "kafkacluster" {
    project_id = ".." # Atlas Project ID
    instance_name = "JSNTFTESTING"
    connection_name = "kafkapl"
    type = "Kafka"
    authentication = {
        mechanism = "PLAIN"
        username = "..."
        password = "..."
    }
    security = {
        protocol = "SSL"
    }
    bootstrap_servers = "lkc-8jwz05.dom1w421e2g.us-east-1.aws.confluent.cloud:9092"

    networking = {
      access = {
        type = "PRIVATE_LINK"
        connection_id = data.mongodbatlas_stream_privatelink_endpoint.singular_datasource.id
      }
    }
}

#processor file
/* 
[
{"$source" : {"connectionName" : "jsncluster0conn", "db" : "test", "coll" : "pltestdata"}},
{"$emit" : {"connectionName" : "kafkapl", "topic" : "test"}}
]
*/

data "local_file" "processor" {
  filename = "PATHTOPROCESSORFILE" 
}

resource "mongodbatlas_stream_processor" "stream-processor-change-stream" {
  project_id = "...." # Atlas Project ID
  instance_name = "JSNTFTESTING"
  processor_name = "csstream"
  pipeline       = data.local_file.processor.content
  state          = "STARTED"
}

