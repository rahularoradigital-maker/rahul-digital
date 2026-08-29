-- Creative Production: store the shop's currency (e.g. INR, USD) on the connection so the Studio product
-- list shows the right symbol instead of assuming USD. Captured from the storefront at connect time.
alter table shopify_connections add column if not exists currency text;
