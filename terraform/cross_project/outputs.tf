output "workspace_a" {
    value = {
      name       = mongodbatlas_stream_workspace.a.workspace_name
      project_id = mongodbatlas_stream_workspace.a.project_id
      hostnames  = mongodbatlas_stream_workspace.a.hostnames
    }
  }
  
  output "connections_in_workspace_a" {
    value = [
      mongodbatlas_stream_connection.a_to_cluster_a.connection_name,
      mongodbatlas_stream_connection.a_to_cluster_b.connection_name,
    ]
  }
