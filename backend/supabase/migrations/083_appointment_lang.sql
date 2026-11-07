-- 083 — Langue des emails envoyés au client final (KLT-0720).
--
-- Posée à la réservation par le formulaire du site ou du widget
-- (data-saas-lang). Absente : emails en français, comme avant.
--
-- À appliquer AVANT de déployer le backend : /book et /paypal-capture écrivent
-- cette colonne dès que le formulaire envoie une langue.

alter table appointment add column if not exists lang text;

alter table appointment drop constraint if exists appointment_lang_check;
alter table appointment add constraint appointment_lang_check
  check (lang is null or lang in ('fr', 'en', 'de', 'nl'));
