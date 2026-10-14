export async function shareOrDownload(name: string, bytes: Uint8Array, mime: string): Promise<'shared' | 'downloaded'> {
  const file = new File([bytes as BlobPart], name, { type: mime });
  const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (n.canShare && n.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch { /* user cancelled → fall back */ } }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  return 'downloaded';
}
