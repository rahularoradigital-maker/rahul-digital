-- Creative Studio: distinct product types (with counts) for the picker's category chips. Grouped in SQL
-- so it is correct at any catalogue size (no un-paginated 1000-row read on the client). Top 40 by frequency.
create or replace function cp_product_types(p_user uuid, p_shop text)
returns table(product_type text, n bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(product_type), ''), 'Uncategorized') as product_type, count(*) as n
  from shopify_products
  where user_id = p_user and shop_domain = p_shop
  group by 1
  order by n desc, 1 asc
  limit 40;
$$;
