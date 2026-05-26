-- Track when ball_in_court_id was last set on an RFI so the UI can
-- determine whether the current holder has responded since receiving
-- the ball. The "Move ball" button only appears once the current
-- holder has added a response after the ball was passed to them.
ALTER TABLE rfis
  ADD COLUMN IF NOT EXISTS ball_in_court_set_at TIMESTAMPTZ;
