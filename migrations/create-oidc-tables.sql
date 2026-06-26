-- migrations/create-oidc-tables.sql
-- OIDC provider tables for SSO integration with Element X / Synapse.
-- Authorization Code flow + PKCE (RFC 7636).

CREATE TABLE IF NOT EXISTS oidc_auth_codes (
  code                   VARCHAR(86)  NOT NULL PRIMARY KEY,   -- 64 random bytes → base64url ≈ 86 chars
  user_id                INT UNSIGNED NOT NULL,
  client_id              VARCHAR(255) NOT NULL,
  redirect_uri           TEXT         NOT NULL,
  scope                  VARCHAR(500) NOT NULL DEFAULT 'openid profile',
  code_challenge         VARCHAR(256) NULL,     -- PKCE S256 challenge
  code_challenge_method  VARCHAR(10)  NULL,     -- 'S256' or NULL
  nonce                  VARCHAR(255) NULL,     -- passed through into id_token
  expires_at             DATETIME     NOT NULL,
  used_at                DATETIME     NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_codes (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS oidc_tokens (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  access_token  VARCHAR(86)  NOT NULL UNIQUE,  -- 64 random bytes → base64url
  user_id       INT UNSIGNED NOT NULL,
  client_id     VARCHAR(255) NOT NULL,
  scope         VARCHAR(500) NOT NULL,
  expires_at    DATETIME     NOT NULL,
  revoked_at    DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_tokens (user_id, revoked_at),
  INDEX idx_expires     (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
