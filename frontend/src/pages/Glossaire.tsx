import { useState } from 'react'
import { Search } from 'lucide-react'
import { GLOSSAIRE } from '../lib/glossaire'

export default function Glossaire() {
  const [q, setQ] = useState('')
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const items = Object.values(GLOSSAIRE).filter((e) => !q || norm(e.terme + ' ' + e.definition).includes(norm(q)))
    .sort((a, b) => a.terme.localeCompare(b.terme, 'fr'))
  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <h1>Le petit lexique</h1>
      <p className="lead ink2">Tous les mots du site, expliqués simplement. Sur le site, les mots soulignés en pointillé affichent aussi leur explication quand vous les survolez ou les touchez.</p>
      <div className="input-suffix" style={{ margin: '12px 0 20px' }}>
        <input type="search" placeholder="Chercher un mot : déficit, budget carbone, décile…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="suffix"><Search size={16} /></span>
      </div>
      <div className="stack">
        {items.map((e) => (
          <div key={e.terme} className="card flat"><h3 style={{ marginBottom: 4 }}>{e.terme}</h3><p className="ink2" style={{ margin: 0 }}>{e.definition}</p></div>
        ))}
      </div>
    </div>
  )
}
