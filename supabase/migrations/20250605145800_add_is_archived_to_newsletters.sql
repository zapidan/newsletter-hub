-- Add is_archived column to newsletters table
alter table newsletters add column is_archived boolean not null default false;
