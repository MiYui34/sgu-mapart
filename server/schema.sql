CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(32) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invitations (
  code VARCHAR(16) PRIMARY KEY,
  created_by INT NOT NULL,
  created_by_name VARCHAR(32) NOT NULL,
  expires_at DATETIME NOT NULL,
  max_uses INT NOT NULL,
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invitations_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS works (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(80) NOT NULL,
  description TEXT,
  tags VARCHAR(255) NOT NULL DEFAULT '',
  maps_x INT NOT NULL,
  maps_y INT NOT NULL,
  preview_path VARCHAR(255) NOT NULL,
  litematic_path VARCHAR(255) NOT NULL,
  settings_json JSON NOT NULL,
  downloads INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_works_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_works_created (created_at),
  INDEX idx_works_downloads (downloads)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
