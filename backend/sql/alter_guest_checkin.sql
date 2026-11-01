-- Existing DB: allow guest check-in without student account
ALTER TABLE attendances
  DROP FOREIGN KEY fk_attendances_student;

ALTER TABLE attendances
  MODIFY student_id INT UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN guest_full_name VARCHAR(150) NULL DEFAULT NULL AFTER student_id,
  ADD COLUMN guest_group_name VARCHAR(100) NULL DEFAULT NULL AFTER guest_full_name,
  ADD UNIQUE KEY uq_attendances_lesson_guest (lesson_id, guest_full_name);

ALTER TABLE attendances
  ADD CONSTRAINT fk_attendances_student
    FOREIGN KEY (student_id) REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE;
