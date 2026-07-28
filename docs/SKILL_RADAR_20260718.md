# Skill Radar — kalkaninfo Self-Improving Sistem (2026-07-18)

Tarandı: 252 repo (son 30 gun) | Kaynak: GitHub claude-code/claude-skill/MCP topic + keyword aramalari
Guvensiz repo tespit edildi: 1 (social-media-scraper-skill — malware, asagida detay)

---

## Sonuclar (Alaka Puanina Gore)

### 1. nowork-studio/NotFair
**Alaka: 9/10 | Efor: Orta | Lisans: MIT | Yildiz: 3150**
URL: https://github.com/nowork-studio/NotFair

**Ne oldugu:** Google Search Console, Google Ads ve Meta Ads'i dogrudan Claude'a baglayan acik kaynak skill seti. `/notfair:google-ads-audit` komutu kampanya israflari tespit eder, meta tag bozukluklarini yazar, trafik dususlerini diagnoz eder. Hem CLI (Claude Code skill) hem web portal (notfair.co) modunda calisir.

**Kalkaninfo'ya somut fayda:** 170+ isletme sayfasinin SEO audit'i tek oturumda; Google Ads'de harcanan butce verimsizliklerini natural language ile tespiti; `lib/cheap-llm.mjs` router ile audit maliyeti minimumda tutulur. Kalkan-info haber/gazete sayfalarinin Google Search Console performansini periyodik izleme GitHub Actions'a tasinabilir.

**Entegrasyon eforu:** GSC OAuth + Google Ads API credential kurulumu gerekiyor (orta efor). Skill'in kendisi cp ile `~/.claude/skills/` altina aliniyor.

---

### 2. kulykivska/claude-plugins
**Alaka: 8/10 | Efor: Dusuk | Lisans: Belirtilmemis | Yildiz: 1**
URL: https://github.com/kulykivska/claude-plugins

**Ne oldugu:** 15 plugin + 13 subagent iceren kisisel marketplace: `seo-strategist` (LLM SEO dahil), `content-writer` (LinkedIn/Threads/X/IG), `social-post`, `growth-analyst`, `researcher`, `outreach-writer` subagent'lari + guardrail hook'lari.

**Kalkaninfo'ya somut fayda:** Gazetedeki tekrar baslik sorununu `content-writer`'in cesitlilik kurallariyla cozme; `seo-strategist`'in GEO (Generative Engine Optimization) destegi 2026 icin kritik; `social-post` mevcut reels otomasyon pipeline'ini zenginlestirir. Subagent kaliplari kopyalanip kalkan-info agent kadrosuna (28 agent) entegre edilebilir.

**Entegrasyon eforu:** Subagent .md dosyalarini `.claude/agents/` altina kopyala, yeterli. Lisans belirtilmemis; kodu once incele.

---

### 3. Steffd415/clawvr-agent-skill
**Alaka: 7/10 | Efor: Dusuk | Lisans: MIT | Yildiz: 4**
URL: https://github.com/Steffd415/clawvr-agent-skill

**Ne oldugu:** Kucuk isletme verticallari (restoran, salon, dis klinigi, muteahhit...) icin 6 sorulu intake + master prompt + 6 workflow superprompt + 30 gunluk deployment roadmap ureten Claude skill'i. 25+ sektoru destekliyor, restoran verticali hazir.

**Kalkaninfo'ya somut fayda:** La Mora ve 22 demo site musteri onboarding'ini hizlandiriyor — isletme sahibine bu skill calistirilip cikan master prompt yapistiriliyor, sifirdan AI asistan aliyorlar. Ajansai satis funnel'inda demo olarak kullanilabilir: "canliya gecmeden once bunun ciktisini deneyin."

**Entegrasyon eforu:** SKILL.md dosyasini `~/.claude/skills/clawvr-smb/` altina kopyala. Hook/install script yok, guvenli.

---

### 4. thedotmack/claude-mem
**Alaka: 6/10 | Efor: Orta | Lisans: Apache-2.0 | Yildiz: 87650**
URL: https://github.com/thedotmack/claude-mem

**Ne oldugu:** Claude Code icin oturumlar arasi sikilastirilmis hafiza sistemi (v13.4.0). Her oturumda agent'in yaptiklarini capture eder, AI ile sikilistirir, sonraki oturuma relevant context inject eder. Turkce README mevcut.

**Kalkaninfo'ya somut fayda:** 28 agent'in oturumlar arasi hafizasini yonetmek icin merkezi katman — mevcut `.claude-mem/` klasoru zaten bu aracinsa duplicate degil, yoksa ek deger. "Self-improving" hedefi icin: her agent oturumunun ogrendiklerini bir sonrakine tasimak bu aracin cekirdek islevi.

**Entegrasyon eforu:** `npm install -g claude-mem` + hook kurulumu. package.json'da postinstall script kontrol edilmeli; Apache-2.0 lisansi guvenli.

---

### 5. jeremylongshore/claude-code-plugins-plus-skills
**Alaka: 5/10 | Efor: Dusuk | Lisans: MIT | Yildiz: 2525**
URL: https://github.com/jeremylongshore/claude-code-plugins-plus-skills

**Ne oldugu:** 470 plugin + 3677 skill + 347 agent iceren buyuk marketplace katalogu. `ccpi` CLI ile kurulum. Her plugin AgentSkills.io standardi ile validate edilmis, 100-puan rubric public. "Killer Skill of the Week" secimi var (su an: tonone — 23 agent full delivery team).

**Kalkaninfo'ya somut fayda:** Kesfetme merkezi olarak kullanilir — kalkaninfo'ya ozel skill aramayi bu katalog uzerinden yapmak radar'i tamamlar. Ozellikle `web-analytics`, `social-post`, `seo-audit` plugin'leri dogrudan alinabilir.

**Entegrasyon eforu:** `pnpm add -g @intentsolutionsio/ccpi` sonra `ccpi install <plugin-adi>`. MIT lisansi.

---

### 6. MAhmed004/ad-ops-mcp-hub
**Alaka: 4/10 | Efor: Yuksek | Lisans: Belirtilmemis | Yildiz: 0**
URL: https://github.com/MAhmed004/ad-ops-mcp-hub

**Ne oldugu:** Google Ads, Meta Ads, GA4, TikTok Ads, LinkedIn Ads'i tek konusmadan yoneten MCP server. 300+ reklam operasyonu, human-in-the-loop safety.

**Kalkaninfo'ya somut fayda:** Kalkaninfo ajansai servisinin reklam yonetimini Claude uzerinden otomatize etmek icin potansiyel — ancak yildiz sifir, lisans yok, README'de download link spam var (sari bayrak). Olgunlasana kadar beklemek daha iyi.

**Entegrasyon eforu:** MCP server kurulumu + 5 platform API credential. Yuksek efor, dusuk guven. Oncelikli degil.

---

### 7. YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill
**Alaka: 3/10 | Efor: Dusuk | Lisans: Belirtilmemis | Yildiz: 1769**
URL: https://github.com/YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill

**Ne oldugu:** Gemini (Nano Banana Pro) gorsel uretimi icin 10.000+ prompt kutuphane arama skill'i. Icerik remixleme, sample image preview, gunde iki kez guncelleme.

**Kalkaninfo'ya somut fayda:** Reels ve gazete gorsellerinde Gemini image generation kullaniliyorsa prompt kalitesini artirmak icin. Ancak kalkaninfo su an FAL/Remotion odakli; Gemini image billing blokajiyla gecmiste sorun yasandi. Dusuk oncelik.

**Entegrasyon eforu:** `npx skills i YouMind-OpenLab/nano-banana-pro-prompts-recommend-skill`. Harici API'ye (youmind.com) bagimli — lisans net degil, dikkatli ol.

---

## Guvenlik Notlari

**KIRMIZI BAYRAK — expropriationhoorayhenry64/social-media-scraper-skill**
Bu repo bir Claude skill DEGIL. README icinde `.exe` indirme linki var ve "Windows Defender uyarisi gorursen 'Yine de calistir'a bas" yazıyor. Klasik malware dagitim pattern'i. Lisans yok. Radar puani yuksek cikti cunku "instagram + social media + content" keyword'leri eslesti. Kesinlikle kurma, klonlama.

**SARI BAYRAK — MAhmed004/ad-ops-mcp-hub**
Lisans yok, README'de download URL spam var, yildiz sifir. MCP server olarak calisacak (yerel sistem erisimi). Kurulmadan once tam kod incelemesi zorunlu.

**SARI BAYRAK — nano-banana + kulykivska**
Her ikisinde de lisans belirtilmemis. kulykivska icin: subagent .md dosyalarini kopyalamadan once icerigi oku. nano-banana: harici API call'lari kendi sunucusuna gidiyor.

---

## Kurulum Sirasi (Onay Sonrasi)

```bash
# 1. NotFair (en yuksek oncelik)
gh repo clone nowork-studio/NotFair
# scripts/ klasoru + hook'lari incele
# Temizse: ~/.claude/skills/notfair/ e kopyala

# 2. kulykivska/claude-plugins (subagent'lar)
gh repo clone kulykivska/claude-plugins
# .claude-plugin/ ve agents/ klasorlerini incele
# Secili subagent'lari: kalkan-info/.claude/agents/ e ekle

# 3. clawvr-agent-skill (musteri onboarding)
gh repo clone Steffd415/clawvr-agent-skill
# SKILL.md oku
# ~/.claude/skills/clawvr-smb/ e kopyala

# 4. claude-mem (hafiza katmani)
gh repo clone thedotmack/claude-mem
# package.json postinstall kontrol et
# Mevcut .claude-mem/ ile cakisma var mi bak
```

---

*Olusturuldu: 2026-07-18 | skill-radar.mjs v1 | 252 repo tarandi*
