-- Existing DB: allow lessons without a group (mixed / збірна пара)
ALTER TABLE lessons
  DROP FOREIGN KEY fk_lessons_group;

ALTER TABLE lessons
  MODIFY group_id INT UNSIGNED NULL DEFAULT NULL;

ALTER TABLE lessons
  ADD CONSTRAINT fk_lessons_group
    FOREIGN KEY (group_id) REFERENCES study_groups (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
