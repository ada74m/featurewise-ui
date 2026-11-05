# The UI shell: its files in a private bucket, served with every service's UI backend from one
# CloudFront distribution, so the browser only ever talks to one origin and needs no CORS.
#
#   /api/<service>/*        the service's UI backend, with the /api/<service> prefix taken off
#   /modules/<service>/*    the service's module, which the service uploads to the bucket
#   /services.json          the shell's configuration, written here
#   anything else           the shell's files, and index.html for any address

data "aws_caller_identity" "current" {}

locals {
  dist = "${path.module}/../dist"

  content_types = {
    html = "text/html; charset=utf-8"
    js   = "text/javascript; charset=utf-8"
    css  = "text/css; charset=utf-8"
    json = "application/json"
    map  = "application/json"
    svg  = "image/svg+xml"
    png  = "image/png"
  }

  # Type declarations are for other TypeScript, not the browser.
  files = [for file in fileset(local.dist, "**") : file if !endswith(file, ".d.ts")]

  config = {
    default = var.default_address
    services = {
      for id, service in var.services : id => { module = "/modules/${id}/index.js", bff = "/api/${id}" }
    }
    signIn = {
      authorizeUrl = var.sign_in.authorize_url
      tokenUrl     = var.sign_in.token_url
      logoutUrl    = var.sign_in.logout_url
      clientId     = var.sign_in.client_id
      scopes       = var.sign_in.scopes
    }
    personas = var.personas
  }
}

resource "aws_s3_bucket" "shell" {
  bucket = "${var.name_prefix}-ui-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "shell" {
  bucket                  = aws_s3_bucket.shell.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# The shell's files change in place, without hashed names, so browsers and CloudFront check each time.
resource "aws_s3_object" "files" {
  for_each = toset(local.files)

  bucket        = aws_s3_bucket.shell.id
  key           = each.value
  source        = "${local.dist}/${each.value}"
  etag          = filemd5("${local.dist}/${each.value}")
  content_type  = lookup(local.content_types, reverse(split(".", each.value))[0], "application/octet-stream")
  cache_control = "no-cache"
}

resource "aws_s3_object" "config" {
  bucket        = aws_s3_bucket.shell.id
  key           = "services.json"
  content       = jsonencode(local.config)
  content_type  = "application/json"
  cache_control = "no-cache"
}

resource "aws_cloudfront_origin_access_control" "shell" {
  name                              = "${var.name_prefix}-ui"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "shell" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.shell.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.shell.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "shell" {
  bucket = aws_s3_bucket.shell.id
  policy = data.aws_iam_policy_document.shell.json
}

# Any address is a page of the shell's, which reads the URL itself; a file is served as it is.
resource "aws_cloudfront_function" "pages" {
  name    = "${var.name_prefix}-ui-pages"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var last = request.uri.split("/").pop();
      if (last.indexOf(".") < 0) request.uri = "/index.html";
      return request;
    }
  JS
}

# A UI backend serves its features at /{feature}, so take off the /api/<service> it's reached by.
resource "aws_cloudfront_function" "backends" {
  name    = "${var.name_prefix}-ui-backends"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      request.uri = request.uri.replace(/^\/api\/[^\/]+/, "") || "/";
      return request;
    }
  JS
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# Passes everything the backend needs: the Authorization and Idempotency-Key headers, the body and the
# query string, which carries a link loaded by GET. Host is left out, so API Gateway sees its own.
data "aws_cloudfront_origin_request_policy" "all_but_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "shell" {
  enabled             = true
  comment             = "${var.name_prefix} UI shell"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    origin_id                = "shell"
    domain_name              = aws_s3_bucket.shell.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.shell.id
  }

  dynamic "origin" {
    for_each = var.services
    content {
      origin_id   = "api-${origin.key}"
      domain_name = regex("^https?://([^/]+)", origin.value.bff_url)[0]
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.services
    content {
      path_pattern             = "/api/${ordered_cache_behavior.key}/*"
      target_origin_id         = "api-${ordered_cache_behavior.key}"
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
      origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_but_host.id

      function_association {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.backends.arn
      }
    }
  }

  default_cache_behavior {
    target_origin_id       = "shell"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.pages.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
