terraform {
  required_version = ">= 1.6.0"

  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = "~> 2.12.0"
    }
  }
}

provider "mongodbatlas" {
  public_key  = var.atlas_public_key
  private_key = var.atlas_private_key
}

# ---------- Workspace A (in Project A) ----------

resource "mongodbatlas_stream_workspace" "a" {
  project_id     = var.project_a_id
  workspace_name = var.workspace_a_name

  data_process_region = {
    region         = var.workspace_a_region
    cloud_provider = "AWS"
  }

  stream_config = {
    tier = "SP30"
  }
}

# ---------- Connection 1: Workspace A → Cluster0-a (same project) ----------

resource "mongodbatlas_stream_connection" "a_to_cluster_a" {
  project_id      = var.project_a_id
  workspace_name  = mongodbatlas_stream_workspace.a.workspace_name
  connection_name = "Cluster0-a"
  type            = "Cluster"

  cluster_name = "Cluster0a"

  db_role_to_execute = {
    role = "atlasAdmin" # scope down to readWrite/etc. in real usage
    type = "BUILT_IN"
  }
}

# ---------- Connection 2: Workspace A → Cluster0-b (cross-project) ----------

resource "mongodbatlas_stream_connection" "a_to_cluster_b" {
  project_id      = var.project_a_id
  workspace_name  = mongodbatlas_stream_workspace.a.workspace_name
  connection_name = "Cluster0b-cross"
  type            = "Cluster"

  cluster_name       = "Cluster0b"
  cluster_project_id = var.project_b_id

  db_role_to_execute = {
    role = "atlasAdmin"
    type = "BUILT_IN"
  }
}
