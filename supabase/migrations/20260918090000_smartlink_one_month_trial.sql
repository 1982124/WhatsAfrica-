begin;
create or replace function public.smartlink_current_tariff()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_country text; v_region text; v_trial timestamptz; v_paid boolean:=false; v_rule public.smartlink_tariff_rules%rowtype; v_trial_end timestamptz;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select upper(nullif(trim(p.country),'')), nullif(trim(p.city),''), p.trial_ends_at into v_country,v_region,v_trial from public.profiles p where p.user_id=v_uid for update;
 select r.* into v_rule from public.smartlink_tariff_rules r where r.plan_code='starter' and r.active and r.effective_from<=now() and (r.effective_until is null or r.effective_until>now()) and (r.country_code is null or lower(r.country_code)=lower(v_country)) and (r.region_code is null or lower(r.region_code)=lower(v_region)) order by (r.region_code is not null) desc,(r.country_code is not null) desc,r.effective_from desc limit 1;
 if v_rule.id is null then raise exception 'SMARTLINK_TARIFF_NOT_CONFIGURED'; end if;
 select exists(select 1 from public.user_subscriptions s where s.user_id=v_uid and s.plan_code in ('starter','business','premium') and s.status in ('trialing','active','past_due') and (s.ends_at is null or s.ends_at>now()) and coalesce(s.provider_reference,'') <> 'wassafrica_owner_permanent_free') into v_paid;
 if v_trial is null and not v_paid and v_rule.trial_days>0 then
   v_trial_end:=now()+make_interval(days=>v_rule.trial_days);
   update public.profiles set trial_ends_at=v_trial_end where user_id=v_uid;
   insert into private.trial_ledger(user_id,claimed_at,trial_ends_at,source,metadata) values(v_uid,now(),v_trial_end,'smartlink_auto',jsonb_build_object('service','smartlink','tariff_id',v_rule.id,'country_code',v_country)) on conflict (user_id) do nothing;
   select trial_ends_at into v_trial from public.profiles where user_id=v_uid;
 end if;
 return jsonb_build_object('service','smartlink','plan_code',v_rule.plan_code,'country_code',v_country,'region_code',v_region,'currency',v_rule.currency,'monthly_amount',v_rule.monthly_amount,'trial_days',v_rule.trial_days,'trial_ends_at',v_trial,'trial_active',coalesce(v_trial>now(),false),'paid_active',v_paid,'paid_required',not(coalesce(v_trial>now(),false) or v_paid),'effective_from',v_rule.effective_from,'effective_until',v_rule.effective_until);
end $$;

create or replace function public.wassafrica_business_smartlink_guard()
returns trigger language plpgsql set search_path=public,pg_catalog
as $$
begin
 new.category:=public.normalize_business_category(new.business_type);
 if tg_op='INSERT' then new.smartlink_last_customization_at:=null; return new; end if;
 if (new.template is distinct from old.template or new.accent_color is distinct from old.accent_color or new.logo_url is distinct from old.logo_url or new.cover_image_url is distinct from old.cover_image_url or new.presentation is distinct from old.presentation or new.tagline is distinct from old.tagline or new.business_type is distinct from old.business_type or new.activity is distinct from old.activity or new.smartlink_teaser_video_url is distinct from old.smartlink_teaser_video_url or new.smartlink_teaser_poster_url is distinct from old.smartlink_teaser_poster_url or new.smartlink_media is distinct from old.smartlink_media) then
   if old.smartlink_last_customization_at is not null and old.smartlink_last_customization_at>now()-interval '7 days' then raise exception 'SMARTLINK_CUSTOMIZATION_WEEKLY_LIMIT'; end if;
   new.smartlink_last_customization_at:=now();
 else new.smartlink_last_customization_at:=old.smartlink_last_customization_at; end if;
 return new;
end $$;
commit;