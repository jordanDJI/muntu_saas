"use client";
import { useState, useEffect } from "react";
import Script from "next/script";
import { getCookieConsentDetail } from "./CookieBanner";

interface TrackingConfig {
  ga4_id?: string;
  meta_pixel_id?: string;
  gtm_id?: string;
}

interface Props {
  tracking: TrackingConfig;
  tenantSlug: string;
  apiUrl: string;
  consentKey: string;
}

export default function TrackingScripts({ tracking, tenantSlug, apiUrl, consentKey }: Props) {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const apply = () => {
      const detail = getCookieConsentDetail();
      setAnalytics(detail.analytics);
      setMarketing(detail.marketing);
    };
    apply();

    const handler = (e: CustomEvent) => {
      if (e.detail?.key === consentKey) {
        setAnalytics(!!e.detail?.analytics);
        setMarketing(!!e.detail?.marketing);
      }
    };
    window.addEventListener("cookie-consent", handler as EventListener);
    return () => window.removeEventListener("cookie-consent", handler as EventListener);
  }, [consentKey]);

  return (
    <>
      {/* ── Analytics (GA4 + GTM + tracker comportemental Klientys) ── */}
      {analytics && (
        <>
          {tracking.gtm_id && (
            <Script id="gtm" strategy="afterInteractive">{`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${tracking.gtm_id}');
            `}</Script>
          )}

          {tracking.ga4_id && (
            <>
              <Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.ga4_id}`} strategy="afterInteractive" />
              <Script id="ga4" strategy="afterInteractive">{`
                window.dataLayer=window.dataLayer||[];
                function gtag(){dataLayer.push(arguments);}
                gtag('js',new Date());gtag('config','${tracking.ga4_id}');
              `}</Script>
            </>
          )}

          {/* Tracker comportemental propriétaire Klientys */}
          <Script id="pp-tracker" strategy="afterInteractive">{`
            (function(){
              var SLUG='${tenantSlug}',API='${apiUrl}';
              var sid=sessionStorage.getItem('_pp_sid');
              if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem('_pp_sid',sid);}
              function send(type,section,data){
                fetch(API+'/api/v1/analytics/event',{method:'POST',headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({tenant_slug:SLUG,session_id:sid,event_type:type,section:section||null,data:data||null}),
                  keepalive:true}).catch(function(){});
              }
              send('pageview');
              if(window.IntersectionObserver){
                var seen={};
                var obs=new IntersectionObserver(function(entries){
                  entries.forEach(function(e){
                    if(e.isIntersecting&&!seen[e.target.id]){seen[e.target.id]=1;send('section_view',e.target.id);}
                  });
                },{threshold:0.3});
                ['hero','a-propos','prestations','contact'].forEach(function(id){
                  var el=document.getElementById(id);if(el)obs.observe(el);
                });
              }
              document.addEventListener('click',function(e){
                var el=e.target.closest('[data-track]');
                if(el)send('cta_click',null,{action:el.getAttribute('data-track')});
              });
              document.addEventListener('submit',function(e){
                var f=e.target.closest('form[data-track-form]');
                if(f)send('form_submit',f.getAttribute('data-track-form'));
              });
            })();
          `}</Script>
        </>
      )}

      {/* ── Marketing (Meta Pixel) ── */}
      {marketing && tracking.meta_pixel_id && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${tracking.meta_pixel_id}');fbq('track','PageView');
        `}</Script>
      )}
    </>
  );
}
