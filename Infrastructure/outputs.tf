output "url" {
  description = "Where the shell is, such as https://d123.cloudfront.net."
  value       = "https://${aws_cloudfront_distribution.shell.domain_name}"
}

output "callback_url" {
  description = "Where the identity provider sends people back to after signing in: the shell's client allows it."
  value       = "https://${aws_cloudfront_distribution.shell.domain_name}/_shell/callback"
}

output "bucket" {
  description = "The shell's bucket, where each service uploads its module under modules/<id>/. Its configured name, so it's known when planning, which a service's count can depend on."
  value       = aws_s3_bucket.shell.bucket
}
