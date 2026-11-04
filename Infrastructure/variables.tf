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
  description = "Where / goes, such as /sample/things."
  type        = string
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
