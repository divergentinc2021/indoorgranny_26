export async function shareOrDownload(name: string, bytes: Uint8Array, mime: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([bytes as BlobPart], name, { type: mime });
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (n.canShare && n.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if ((e as DOMException).name === 'AbortError') return 'cancelled'; /* any other failure → fall back to download */ } }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
