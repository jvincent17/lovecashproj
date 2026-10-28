/** Tutup splash screen (didefinisikan di index.html). Aman dipanggil berkali-kali. */
export const hideSplash = () => { try { window.__hideSplash?.() } catch { /* */ } }
