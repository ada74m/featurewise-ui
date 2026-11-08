output "url" {
  description = "Where the shell is: its own domain if it has one, such as https://demos.featurewise.dev, or else its CloudFront address, such as https://d123.cloudfront.net."
  value       = "https://${local.host}"
}

output "callback_url" {
  description = "Where the identity provider sends people back to after signing in: the shell's client allows it."
  value       = "https://${local.host}/_shell/callback"
}

output "bucket" {
  description = "The shell's bucket, where each service uploads its module under modules/<id>/. Its configured name, so it's known when planning, which a service's count can depend on."
  value       = aws_s3_bucket.shell.bucket
}

output "distribution_domain_name" {
  description = "The distribution's CloudFront address, such as d123.cloudfront.net, which an alias record for the shell's domain points at."
  value       = aws_cloudfront_distribution.shell.domain_name
}

output "hosted_zone_id" {
  description = "CloudFront's hosted zone, which an alias record pointing at the distribution names."
  value       = aws_cloudfront_distribution.shell.hosted_zone_id
}
