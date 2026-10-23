CREATE TABLE provider_rate_windows (
  tax_id text NOT NULL,
  window_started_at bigint NOT NULL,
  request_count integer NOT NULL,
  PRIMARY KEY (tax_id, window_started_at),
  CONSTRAINT provider_rate_windows_count_range CHECK (request_count BETWEEN 1 AND 80)
);

CREATE TABLE synthetic_pending_issuances (
  id text PRIMARY KEY,
  venue_id text NOT NULL,
  status text NOT NULL,
  requested_at bigint NOT NULL,
  CONSTRAINT synthetic_pending_issuances_status CHECK (
    status IN (
      'generated',
      'sending',
      'accepted',
      'rejected',
      'pending_issuance',
      'uncertain'
    )
  )
);
