// Glance backend — template-based draft replies (deterministic, no LLM, no key).
// The "AI draft" is a keyword-aware template pick, labelled as a draft in the UI.
// Bilingual: Indonesian first (Ivan's chats), English second.

const CHIPS_ID = ['Oke, gas 👍', 'Siap, thanks infonya', 'Noted, gw cek dulu']
const CHIPS_EN = ['Got it, thanks!', 'On it 👍', 'Thanks for sharing!']

function draftLine(text, lang) {
  const t = (text || '').toLowerCase()
  const id = lang !== 'en'
  if (/airdrop|whitelist|wl|mint|claim|giveaway/.test(t))
    return id ? 'Thanks infonya, gw cek syaratnya dulu' : 'Thanks, checking the requirements first'
  if (/\?/.test(t))
    return id ? 'Menarik, gw cek dulu ya' : 'Interesting — checking on it'
  if (/update|launch|live|baru|new|release/.test(t))
    return id ? 'Oke, noted. Gw pantau updatenya' : 'Noted, will keep an eye on updates'
  if (/harga|price|pump|dump|naik|turun|chart/.test(t))
    return id ? 'Noted, gw liat chartnya dulu' : 'Noted, checking the chart first'
  return id ? 'Oke, noted. Thanks!' : 'OK, noted. Thanks!'
}

export function makeDraft(text, lang = 'id') {
  const clean = (text || '').replace(/\s+/g, ' ').trim().slice(0, 500)
  return {
    draft: draftLine(clean, lang),
    chips: lang === 'en' ? CHIPS_EN : CHIPS_ID,
    lang,
  }
}

/** Deep links that open Telegram on the phone with the draft prefilled. */
export function shareLinks(draft, sourceLink) {
  const text = encodeURIComponent(draft)
  const url = encodeURIComponent(sourceLink || '')
  return {
    // Opens Telegram share sheet: user picks the chat, message is prefilled.
    shareUrl: `https://t.me/share/url?url=${url}&text=${text}`,
    // Direct message composer (mobile clients).
    tgMsg: `tg://msg?text=${text}`,
  }
}
