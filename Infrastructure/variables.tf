variable "name_prefix" {
  description = "Prefixes every resource's name."
  type        = string
}

variable "services" {
  description = "The services the shell hosts, by id, each with its UI backend's URL, such as an API Gateway stage's invoke URL. The shell reaches each at /api/<id>/, and loads its module from /modules/<id>/index.js, which the service uploads to the shell's bucket."
  type = map(object({
    bff_url = string
  }))

  validation {
    condition     = alltrue([for id in keys(var.services) : can(regex("^[a-z0-9][a-z0-9-]*$", id))])
    error_message = "A service id is lower-case letters, digits and dashes, and can't start with _ or a dash."
  }
}

variable "default_address" {
  description = "Where / goes, such as /sample/things. Where there are demos, / is their home page instead."
  type        = string
}

variable "title" {
  description = "What the site is called, where there are demos, such as Featurewise demos: the bar across the top of every page says it, and leads home."
  type        = string
  default     = null
}

variable "sign_in" {
  description = "The environment's identity provider, as OpenID Connect endpoints, and the shell's client there, which has no secret: the shell signs in by the authorization code flow with PKCE. The logout URL includes whatever the provider needs, such as Cognito's client_id and logout_uri."
  type = object({
    authorize_url = string
    token_url     = string
    logout_url    = string
    client_id     = string
    scopes        = optional(list(string), ["openid"])
  })
}

variable "personas" {
  description = "Who a visitor can be, where the sign-in has personas, as the demos' does: each with its id, which the shell names in login_hint, a label, the demo it belongs to, which the persona bar shows it on, and its groups."
  type = list(object({
    id     = string
    label  = optional(string)
    demo   = optional(string)
    groups = optional(list(string), [])
  }))
  default = []
}

variable "demos" {
  description = "The demos, where a service has them, as the demos service's demos.json lists them: each with its id, the first part of its addresses, its title, chapter, text (about, storySoFar, tryThis), personas, and reset link. The shell becomes their site: a bar linking to each, a home page listing them, and each one's text beside its pages, with its personas."
  type        = any
  default     = []
}

variable "domain" {
  description = "The shell's own host name, such as demos.featurewise.dev, and an ACM certificate for it, which CloudFront needs in us-east-1. The environment owns the DNS: it validates the certificate and points the name at the distribution (see the hosted_zone_id output). Without one, the shell is at its CloudFront address."
  type = object({
    name            = string
    certificate_arn = string
  })
  default = null
}
