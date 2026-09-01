-- Creative Studio: recommendations become WHITE-SPACE aware — products NOT yet advertised (no cp_assets row)
-- surface first, so the list advances as ads get made. Grounded in real Shopify fields + own asset history;
-- NOT ad performance. (create-or-replace; return type changed so drop first.)
drop function if exists cp_product_opportunities(uuid, text, integer);
create function cp_product_opportunities(p_user uuid, p_shop text, p_limit int default 12)
returns table(product_id text, title text, price numeric, compare_at_price numeric, featured_image_url text, product_type text, discount_pct int, saving numeric, advertised boolean, score numeric)
language sql stable security definer set search_path = public as $$
  with base as (
    select product_id, title, price, compare_at_price, featured_image_url, product_type,
      case when compare_at_price is not null and price is not null and compare_at_price > price and compare_at_price > 0
           then round(((compare_at_price - price) / compare_at_price) * 100)::int else 0 end as discount_pct,
      case when compare_at_price is not null and price is not null and compare_at_price > price
           then (compare_at_price - price) else 0 end as saving,
      (featured_image_url is not null) as has_image,
      exists (select 1 from cp_assets a where a.user_id = p_user and a.product_id = shopify_products.product_id) as advertised
    from shopify_products
    where user_id = p_user and shop_domain = p_shop
      and coalesce(status, 'active') <> 'archived'
      and title not ilike '%test%'
  )
  select product_id, title, price, compare_at_price, featured_image_url, product_type, discount_pct, saving, advertised,
    (case when has_image then saving else 0 end) as score
  from base
  order by advertised asc, score desc, discount_pct desc, title asc
  limit greatest(1, least(p_limit, 50));
$$;
