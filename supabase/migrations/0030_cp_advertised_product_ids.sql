-- Creative Studio: distinct products a user+brand has already generated ads for (own asset history), grouped
-- in SQL so it is scale-safe. Drives the picker's "already advertised" white-space badge.
create or replace function cp_advertised_product_ids(p_user uuid, p_brand uuid)
returns table(product_id text)
language sql stable security definer set search_path = public as $$
  select distinct product_id from cp_assets where user_id = p_user and brand_id = p_brand;
$$;
