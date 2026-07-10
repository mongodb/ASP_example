 variable "atlas_public_key" {
    type      = string
    sensitive = true
  }

  variable "atlas_private_key" {
    type      = string
    sensitive = true
  }

  variable "project_a_id"       { type = string }
  variable "project_b_id"       { type = string }

  variable "workspace_a_name"   { default = "asp-workspace-a" }
  variable "workspace_b_name"   { default = "asp-workspace-b" }
  variable "workspace_a_region" { default = "US_EAST_1" }
  variable "workspace_b_region" { default = "US_EAST
