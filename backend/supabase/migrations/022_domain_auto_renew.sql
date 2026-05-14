-- Préférence de renouvellement automatique du domaine acheté via OVH
alter table custom_domain add column if not exists auto_renew boolean default true;
