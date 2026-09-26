-- Cover high-value Smart Link, demand, and partner foreign keys.
create index if not exists smart_link_assets_smart_link_id_idx on public.smart_link_assets (smart_link_id);
create index if not exists smart_link_assets_asset_id_idx on public.smart_link_assets (asset_id);
create index if not exists smart_link_assets_user_id_idx on public.smart_link_assets (user_id);
create index if not exists demand_clusters_product_id_idx on public.demand_clusters (product_id);
create index if not exists demand_observations_product_id_idx on public.demand_observations (product_id);
create index if not exists demand_observations_source_id_idx on public.demand_observations (source_id);
create index if not exists demand_report_items_report_id_idx on public.demand_report_items (report_id);
create index if not exists demand_report_items_cluster_id_idx on public.demand_report_items (cluster_id);
create index if not exists demand_report_items_observation_id_idx on public.demand_report_items (observation_id);
create index if not exists product_demand_requests_created_by_idx on public.product_demand_requests (created_by);
create index if not exists product_demand_requests_duplicate_of_idx on public.product_demand_requests (duplicate_of);
create index if not exists wassafrica_partner_activities_business_id_idx on public.wassafrica_partner_activities (business_id);
create index if not exists wassafrica_partner_activities_user_id_idx on public.wassafrica_partner_activities (user_id);
create index if not exists wassafrica_partner_referrals_referred_business_id_idx on public.wassafrica_partner_referrals (referred_business_id);
create index if not exists wassafrica_partner_referrals_referred_user_id_idx on public.wassafrica_partner_referrals (referred_user_id);
create index if not exists wassafrica_partner_commissions_referral_id_idx on public.wassafrica_partner_commissions (referral_id);
