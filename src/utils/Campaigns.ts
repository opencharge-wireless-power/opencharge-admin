// src/utils/campaigns.ts
export const QR_REDIRECT_BASE_URL = "https://opencharge-qr.web.app";

export function buildQrUrl(campaignId: string, locationId: string): string {
  const params = new URLSearchParams({
    c: campaignId,
    l: locationId,
    s: "qr",
  });
  return `${QR_REDIRECT_BASE_URL}?${params.toString()}`;
}