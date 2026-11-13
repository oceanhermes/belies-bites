export type SendResult = {
  state: "SENT" | "RETRY" | "UNKNOWN" | "BLOCKED";
  providerId?: string;
  error?: string;
};
export async function sendWhatsApp(
  target: string,
  message: string,
): Promise<SendResult> {
  if (process.env.WHATSAPP_ENABLED !== "true" || !process.env.FONNTE_TOKEN)
    return { state: "BLOCKED", error: "Fonnte belum dikonfigurasi" };
  try {
    const r = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: process.env.FONNTE_TOKEN },
      body: new URLSearchParams({ target, message, countryCode: "62" }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 429)
      return { state: "RETRY", error: "Batas permintaan provider" };
    if (!r.ok)
      return {
        state: r.status >= 500 ? "UNKNOWN" : "BLOCKED",
        error: `HTTP ${r.status}`,
      };
    const j = await r.json();
    if (j.status === true)
      return {
        state: "SENT",
        providerId: Array.isArray(j.id) ? j.id.join(",") : String(j.id ?? ""),
      };
    return {
      state: "BLOCKED",
      error:
        "Provider menolak pesan; periksa dashboard Fonnte, kuota dan perangkat",
    };
  } catch {
    return {
      state: "UNKNOWN",
      error:
        "Hasil pengiriman tidak pasti; periksa dashboard provider sebelum mencoba ulang",
    };
  }
}
