export function applyPreview(tpl: string, content: string, signature: string, closing: string) {
  const base = (content || '').trim()
  const sig = (signature || '').trim()
  const clo = (closing || '').trim()

  const t = (tpl || '').trim()
  if (!t) {
    return sig ? `${base}\n\n${sig}`.trim() : base
  }

  let out = t
  if (out.includes('{{content}}')) out = out.replaceAll('{{content}}', base)
  else out = `${out.trimEnd()}\n\n${base}`.trim()

  if (clo) {
    if (out.includes('{{closing}}')) out = out.replaceAll('{{closing}}', clo)
    else out = `${out.trimEnd()}\n\n${clo}`.trim()
  } else {
    out = out.replaceAll('{{closing}}', '')
  }

  if (out.includes('{{signature}}')) out = out.replaceAll('{{signature}}', sig)
  else if (sig) out = `${out.trimEnd()}\n\n${sig}`.trim()

  return out.trim()
}

