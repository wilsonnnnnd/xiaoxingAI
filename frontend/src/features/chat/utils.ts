export type _PField = { label: string; value: string }
export type _PSection =
    | { kind: 'intro'; text: string }
    | { kind: 'numbered'; num: number; title: string; fields: _PField[] }
    | { kind: 'notes'; items: string[] }

export function parsePersona(raw: string): _PSection[] {
    const out: _PSection[] = []
    let introBuf: string[] = []
    let cur: Extract<_PSection, { kind: 'numbered' }> | Extract<_PSection, { kind: 'notes' }> | null = null

    const flush = () => {
        if (cur) { out.push(cur); cur = null }
        const t = introBuf.join('\n').trim()
        if (t) out.push({ kind: 'intro', text: t })
        introBuf = []
    }

    for (const ln of raw.split('\n')) {
        const numM   = ln.match(/^(\d+)\.\s+(.+)/)
        const noteM  = ln.match(/^请注意[：:]?/)
        const fieldM = ln.match(/^[-•]\s+([^：:]+)[：:](.+)/)
        const bulletM = ln.match(/^[-•]\s+(.+)/)

        if (noteM) {
            flush(); cur = { kind: 'notes', items: [] }
        } else if (numM) {
            flush(); cur = { kind: 'numbered', num: parseInt(numM[1]), title: numM[2].trim(), fields: [] }
        } else if (fieldM && cur?.kind === 'numbered') {
            cur.fields.push({ label: fieldM[1].trim(), value: fieldM[2].trim() })
        } else if (bulletM && cur?.kind === 'notes') {
            cur.items.push(bulletM[1].trim())
        } else if (!cur && ln.trim()) {
            introBuf.push(ln)
        }
    }
    flush()
    return out
}
