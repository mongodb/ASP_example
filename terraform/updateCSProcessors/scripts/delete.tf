# Terraform file for SPI and Atlas Connection

terraform {
  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 1.19.0"
    }
  }
    required_version = ">= 1.0"

}

# variables to import (from exported values)
variable "MONGODB_ATLAS_PUBLIC_KEY" {
  type = string
}

variable "MONGODB_ATLAS_PRIVATE_KEY" {
  type = string
}

variable "MONGODB_ATLAS_PROJECT_ID" {
  type = string
}

variable "MONGODB_ATLAS_INSTANCE_NAME" {
  type = string
}

variable "KAFKA_USER" {
  type = string
}

variable "KAFKA_PASSWORD" {
  type = string
}

variable "OLD_PROCESSOR" {
  type = string
}

variable "NEW_PROCESSOR" {
  type = string
}

variable "RESUME_TOKEN" {
  type = string
}

# Configure the MongoDB Atlas Provider
provider "mongodbatlas" {
  public_key = var.MONGODB_ATLAS_PUBLIC_KEY
  private_key  = var.MONGODB_ATLAS_PRIVATE_KEY
  
}

# Create the resources
#SPI
resource "mongodbatlas_stream_instance" "spitest" {
    project_id = var.MONGODB_ATLAS_PROJECT_ID
    instance_name = var.MONGODB_ATLAS_INSTANCE_NAME
    data_process_region = {
        region = "VIRGINIA_USA"
        cloud_provider = "AWS"
  }
}

# Atlas Connection
resource "mongodbatlas_stream_connection" "atlasconn" {
    depends_on = [mongodbatlas_stream_instance.spitest]
    project_id = var.MONGODB_ATLAS_PROJECT_ID
    instance_name = var.MONGODB_ATLAS_INSTANCE_NAME
    connection_name = "jsncluster0"
    type = "Cluster"
    cluster_name = "jsncluster0"
}
