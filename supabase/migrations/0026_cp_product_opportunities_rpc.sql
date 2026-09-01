-- Creative Studio: rank products to advertise by OFFER STRENGTH (discount depth) gated by AD-READINESS
-- (has an image). Grounded ONLY in real Shopify fields — NOT ad performance (no per-product Meta results
-- here). Deterministic + explainable + scale-safe (grouped in SQL, top N only).
create or replace function cp_product_opportunities(p_user uuid, p_shop text, p_limit int default 12)
returns table(product_id text, title text, price numeric, compare_at_price numeric, featured_image_url text, product_type text, discount_pct int, score int)
language sql stable security definer set search_path = public as $$
  with base as (
    select product_id, title, price, compare_at_price, featured_image_url, product_type,
      case when compare_at_price is not null and price is not null and compare_at_price > price and compare_at_price > 0
           then round(((compare_at_price - price) / compare_at_price) * 100)::int else 0 end as discount_pct,
      (featured_image_url is not null) as has_image
    from shopify_products
    where user_id = p_user and shop_domain = p_shop and coalesce(status, 'active') <> 'archived'
  )
  select product_id, title, price, compare_at_price, featured_image_url, product_type, discount_pct,
    (case when has_image then discount_pct else 0 end) as score
  from base
  order by score desc, discount_pct desc, title asc
  limit greatest(1, least(p_limit, 50));
$$;
