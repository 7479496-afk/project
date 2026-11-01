-- Existing DB: optional geolocation on lessons and attendances
ALTER TABLE lessons
  MODIFY latitude DECIMAL(10, 7) NULL DEFAULT NULL,
  MODIFY longitude DECIMAL(10, 7) NULL DEFAULT NULL,
  MODIFY radius_meters INT UNSIGNED NULL DEFAULT 100;

ALTER TABLE attendances
  MODIFY latitude DECIMAL(10, 7) NULL DEFAULT NULL,
  MODIFY longitude DECIMAL(10, 7) NULL DEFAULT NULL;
