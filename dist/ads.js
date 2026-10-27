/**
 * KYROSHIX RELEASES — optional Google AdSense bootstrap.
 * AdSense remains OFF until an approved account and real publisher ID exist.
 * Never put passwords, service-role keys, or private API credentials here.
 */
const config = window.KYROSHIX_ADS_CONFIG || { enabled: false, publisherId: "" };
const publisherId = typeof config.publisherId === "string" ? config.publisherId.trim() : "";
const validPublisherId = /^ca-pub-\d{16}$/.test(publisherId);

if (config.enabled === true && validPublisherId &&
    !document.querySelector('script[data-kyroshix-adsense="true"]')) {
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.kyroshixAdsense = "true";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
  document.head.append(script);
}

document.documentElement.dataset.adsense =
  config.enabled === true && validPublisherId ? "configured" : "not-configured";
