/*
  # Create newsletters table and security policies

  1. New Tables
    - `newsletters`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `title` (text)
      - `sender` (text)
      - `content` (text)
      - `summary` (text, nullable)
      - `received_at` (timestamp)
      - `is_read` (boolean)
      - `image_url` (text, nullable)

  2. Security
    - Enable RLS on `newsletters` table
    - Add policy for authenticated users to read their own newsletters
    - Add policy for authenticated users to update their own newsletters
*/

CREATE TABLE IF NOT EXISTS newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  sender text NOT NULL,
  content text NOT NULL,
  summary text,
  received_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own newsletters"
  ON newsletters
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own newsletters"
  ON newsletters
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);