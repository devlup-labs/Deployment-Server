output "verification_status" {
  value = "Verified! GCP Account has access to Project: ${data.google_project.verify.name} (ID: ${data.google_project.verify.project_id})"
}
