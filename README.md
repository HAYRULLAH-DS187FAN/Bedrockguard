# BedrockGuard

BedrockGuard, birden çok **Minecraft Bedrock Dedicated Server** için sohbet ve oyun olaylarını değerlendiren; puanları zamanla azaltan, yanlış pozitifleri sınırlayan ve kritik yaptırımlarda insan doğrulaması isteyen bir moderasyon kontrol katmanıdır. Yönetim paneli, BDS Agent’larının imzalı isteklerini alır; kural motoru ve isteğe bağlı LLM sinyalini uygular; oluşan kanıtları, oyuncu durumunu ve yaptırım akışını merkezi olarak yönetir.

> BedrockGuard’da LLM çıktısı hiçbir zaman tek başına yaptırım üretmez. Nihai sonuç kural sinyalleri, puan, yakın geçmiş, tekrar sayısı ve yapılandırılmış korumalarla belirlenir.

## Mimari

```text
Minecraft BDS / Yerel köprü
        │ HMAC-SHA-256 + HTTPS
        ▼
BedrockGuard Agent API
        │
        ▼
Moderation Engine ──► Decision Engine ──► Onay kuyruğu ──► BDS yaptırım adaptörü
        │                     │
        ├── Kanıt ve denetim kayıtları
        ├── Admin Paneli
        └── Discord webhook bildirimi
```

Minecraft’ın Script API’si sohbet, blok kırma ve oyuncu yaşam döngüsü gibi olaylara abone olmayı destekler. BDS’ye özgü `@minecraft/server-net` paketi HTTP istekleri sunar; resmî belgeler bu paketin ön-sürüm olduğunu belirtir. Bu nedenle proje, sürüm uyumsuzluğunda da çalışabilen yerel köprü yolunu ayrıca içerir. [1] [2]

| Katman | Sorumluluk | Güvenlik sınırı |
|---|---|---|
| BDS davranış paketi | Sohbet ve gerekli oyun olaylarını daraltılmış şemada yakalar. | Oyun durumunu tek başına cezalandırmaz. |
| Bridge Agent | HMAC imzası, HTTPS teslimi ve yaptırım kuyruğu alma işlemlerini yapar. | Her sunucu için özgün anahtar kimliği ve gizli anahtar kullanır. |
| Moderation Engine | Kural sinyali, spam analizi, puan azaltma ve karar üretir. | LLM yalnızca sınırlı ek risk puanı üretebilir. |
| Admin Paneli | Sunucular, oyuncular, kanıtlar, whitelist, eşikler ve Discord ayarlarını yönetir. | Yönetici rolü olmadan erişime izin vermez. |

## MVP Kapsamı

Sistem, çoklu sunucu izolasyonu için her kaynağı `serverId` ile ayırır. Her BDS kendi Agent kimliğine, şifreli saklanan Agent sırrına, moderasyon ayarlarına, Discord webhook’una, whitelist’ine, olay dizisine ve yaptırım kuyruğuna sahiptir.

| Alan | Uygulanan davranış |
|---|---|
| Sohbet kuralları | Küfür/hakaret, yasaklı kelime, bağlantı/reklam, şüpheli davet-bağlantı, tehdit/taciz, flood ve tekrarlı mesaj tespiti. |
| Oyun olayları | Yetkisiz komut, hareket hızı, blok kırma hızı ve eşya kazanım hızı için yapılandırılabilir eşikler. |
| Puanlama | Örnek olarak spam `+5`, küfür `+10`, reklam-link `+22–30`, tehdit `+20` ve davranış anomalisi `+20` üretir. Puan, varsayılan 12 saatlik yarılanma ömrüyle azalır. |
| Karar sistemi | `0–39 normal`, `40–69 izleme`, `70+ uyarı/inceleme`; kick ve geçici ban için tekrar ve/veya farklı sinyal koruması aranır. Varsayılan geçici ban otomasyonu kapalıdır. |
| İnsan onayı | Kick, geçici ban, manuel işlem ve tekil yüksek risk sinyallerinde onay kuyruğu kullanılır. Agent yalnızca doğrulanmış işlemleri alır. |
| AI sinyali | Kapalı gelir; etkinleştirildiğinde yapılandırılmış sınıflandırma döndürür ve puanı sınırlandırılmıştır. Yaptırım motoru bundan bağımsız kontrol uygular. |
| Discord | Önemli izleme/yaptırım olaylarını webhook ile bildirir. Bir Discord botu için oyuncu sorgu adaptör sözleşmesi `docs/discord-adapter.md` içindedir. |

## Yönetim Paneli ile İlk Kurulum

Uygulamayı açıp yönetici olarak giriş yaptıktan sonra **Gözetim merkezi** sayfasında ilk BDS sunucusunu oluşturun. Sistem yalnızca bu adımda `agentKeyId` ve `agentSecret` değerini açık metin olarak gösterir; gizli anahtarı güvenli bir parola yöneticisine kaydedin. Sır daha sonra yalnızca şifreli biçimde saklanır.

Ardından **Kurallar ve ayarlar** sayfasından puan eşiklerini, kelime/komut listelerini, flood penceresini, davranış eşiklerini, LLM yardımcısını ve Discord webhook’unu her sunucu için bağımsız yapılandırın. **Whitelist** sayfası, bilinen güvenilir oyuncuların düşük etkili sohbet sinyalleri nedeniyle otomatik puan almasını engeller; yüksek etkili olayları gizlemez.

## Agent Kurulumu

### 1. Yerel Bridge Agent

`agent/bridge/config.example.json` dosyasını `config.json` olarak kopyalayın. `endpoint` alanı uygulamanızın kök adresiyle başlayan `/api/agent` yoludur.

```json
{
  "endpoint": "https://guard.example.com/api/agent",
  "agentKeyId": "bgk_...",
  "agentSecret": "bg_...",
  "pollIntervalMs": 5000
}
```

Köprüyü BDS’nin çalıştığı veya olaylara güvenli biçimde erişebilen makinede başlatın:

```bash
node agent/bridge/bedrockguard-agent.mjs config.json < events.ndjson
```

Olay girişleri **NDJSON** biçiminde olmalıdır. İzin verilen türler `chat`, `command`, `player_join`, `player_leave`, `block_break`, `item_gain`, `movement` ve `player_death` değerleridir.

```json
{"eventId":"d7ba7c62-aaa1-4bcb-a4c3-eee7c6f09c55","occurredAt":1787490000000,"type":"chat","player":{"uuid":"player-xuid-or-uuid","name":"Alex"},"content":"Merhaba dünya"}
```

Köprü, doğrulanmış yaptırım komutlarını stdout üzerinden `bedrockguard_command` satırları olarak yayınlar. Yerel komut adaptörünüz yalnızca bu çıktıyı tüketmeli, komutu BDS’ye uygulamalı ve sonucu Agent onay uç noktasına iletmelidir. BDS’nin `before` olaylarında oyun durumunu değiştirmek kısıtlandığından, yaptırım uygulaması ayrı bir zamanlanmış komut/uygulama akışıyla yapılmalıdır. [1]

### 2. BDS Script API Adaptörü

`agent/behavior-pack` altında bir davranış paketi şablonu bulunur. Paket sohbet, ilk oyuncu doğumu, oyuncu ayrılışı ve blok kırma olaylarını `bedrockguard:event` Script Event olarak dışarı verir. Yerel adaptörünüz bu Script Event’i NDJSON’a dönüştürerek Bridge Agent’a vermelidir.

Script API sürümü BDS sürümüne göre değişebildiği için `manifest.json` içindeki `@minecraft/server` ve `@minecraft/server-net` bağımlılıklarını kendi BDS sürümünüzün üretilmiş API belgelerine göre doğrulayın. `@minecraft/server-net` yalnızca BDS’de kullanılabilir ve ön-sürüm niteliğindedir. [2]

## İmzalı Agent API Sözleşmesi

Tüm Agent uçları aşağıdaki başlıkları zorunlu tutar. Sunucu, zaman damgasında iki dakikadan büyük sapmayı, tekrar edilen nonce’ları, geçersiz imzaları, geçersiz şemayı ve dakika başına 180 isteği reddeder.

| Başlık | Açıklama |
|---|---|
| `X-BedrockGuard-Key-Id` | Panelde üretilen Agent anahtar kimliği. |
| `X-BedrockGuard-Timestamp` | Milisaniye cinsinden Unix zamanı. |
| `X-BedrockGuard-Nonce` | Her istek için tekil, en fazla 128 karakter değer. |
| `X-BedrockGuard-Signature` | `HMAC-SHA-256(secret, METHOD + "\n" + PATH + "\n" + timestamp + "\n" + nonce + "\n" + stableJSON(body))` sonucu. |

| Uç | İşlev | Başarı yanıtı |
|---|---|---|
| `POST /api/agent/events` | Tek bir oyun veya sohbet olayını kabul eder. | `202 { accepted, score, decision, requiresConfirmation }` |
| `GET /api/agent/commands` | Doğrulanmış yaptırım kuyruğunu döndürür. | `200 { commands: [...] }` |
| `POST /api/agent/commands/ack` | Uygulama sonucunu kaydeder. | `200 { acknowledged: true }` |

`POST /api/agent/events` için gövde 512 karakteri aşmayan isteğe bağlı `content`, 64 karakteri aşmayan oyuncu adı, 96 karakteri aşmayan oyuncu kimliği ve sınırlandırılmış metadata kabul eder. Token, imza, bağlantı ve IP benzeri değerler güvenli günlüklerde maskelenir.

## Discord Kurulumu ve Bot Adaptörü

Her sunucunun ayarlarında Discord webhook URL’sini girin. Webhook teslimi bir hata izolasyon katmanından geçer; Discord teslimi başarısız olsa da olay işleme ve BDS operasyonu durmaz. Bildirim gövdesi oyuncu adı, risk puanı, karar ve kısa gerekçeyle sınırlandırılır.

Discord üzerinden yetkili oyuncu durumu sorgusu için bot uygulamanızın doğrulanmış etkileşimini kendi altyapınızda karşılayıp `docs/discord-adapter.md` içindeki adaptörü kullanın. Discord botu, yalnızca kendi rol denetimini geçtikten sonra yönetici tRPC prosedürlerine servis kimliğiyle bağlanmalıdır; webhook URL’sini veya Agent sırlarını hiçbir Discord yanıtına koymayın.

## LLM Yardımcı Analizi

LLM analizi başlangıçta kapalıdır. Açıldığında, mesajı yalnızca `harassment`, `threat`, `advertising` veya `none` sınıflarıyla, güven değeri ve kısa gerekçeyle yapılandırılmış JSON olarak değerlendirir. Düşük güvenli sinyaller atılır; kabul edilen sinyalin puanı yapılandırılmış üst sınır ile sınırlanır. Model çağrısı yalnızca sunucu tarafında gerçekleşir ve istemciye anahtar gönderilmez.

> Önerilen işletim yaklaşımı, LLM’yi yalnızca kural sinyalleriyle zaten riskli görünen mesajlar için etkinleştirmek, kabul eşiğini yüksek tutmak ve kritik yaptırımlar için insan onayını korumaktır.

## Güvenlik ve İşletim Kontrol Listesi

| Kontrol | Uygulama |
|---|---|
| Yönetici yetkisi | Panel prosedürleri `admin` rolü gerektirir. İlk proje sahibi oturum açtığında yönetici olur. |
| Agent kimliği | Her sunucu için ayrı anahtar kimliği, şifreli sır, HMAC imza, zaman kontrolü ve nonce tekrar koruması. |
| Hız sınırlama | Agent kimliği başına kaydırmalı pencerede 180 istek/dakika. |
| Hassas loglama | Token, sır, imza, mesaj içeriği, bağlantı ve IP benzeri değerler maskelenir. |
| Yaptırım doğrulama | Kritik eylemler `pending_confirmation` durumunda başlar; yönetici doğrulamasından sonra Agent kuyruğuna geçer. |
| Hata izolasyonu | Agent olay, LLM ve Discord hataları ana BDS akışını düşürmek yerine güvenli yanıt ve denetim kaydı üretir. |
| Veri minimizasyonu | Yalnızca oyuncu kimliği, adı, olay türü, zaman, sınırlı içerik ve olay için gerekli metadata saklanır. |

## Yerel Geliştirme

```bash
pnpm install
pnpm drizzle-kit generate
pnpm dev
```

Şema değişikliğinden sonra üretilen SQL’i gözden geçirin ve yalnızca ardından veritabanına uygulayın. Bu proje şemasını ilk kez kurmak için uygulama içi geçiş işlemi kullanılmalıdır.

| Komut | Amaç |
|---|---|
| `pnpm check` | TypeScript tür denetimi. |
| `pnpm test` | Moderasyon, yanlış-pozitif, puan azalması, karar eşikleri, HMAC ve hız sınırlama testleri. |
| `pnpm build` | İstemci ve sunucu üretim derlemesi. |

## Bilinen MVP Sınırları

Bu MVP, BDS’ye uygulama komutunu ulaştırmak için yerel bir komut adaptörüne ihtiyaç duyar; BDS sürümlerinin Script API yüzeyi farklılık gösterebilir. `@minecraft/server-net` ön-sürüm olduğundan doğrudan HTTP teslimi, yalnızca hedef BDS sürümünde doğrulandıktan sonra tercih edilmelidir. Kısa süreli banın standart davranışı, Agent adaptörünün seçtiğiniz BDS yönetim eklentisi veya izinli komut stratejisine bağlıdır. BDS’nin kendi API yüzeyi bu projede varsayılmaz ve belge/örneklerdeki olay adları hedef sürüme göre kontrol edilmelidir. [1] [2]

## Kaynaklar

[1] [Microsoft Learn — Working With Events](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/events?view=minecraft-bedrock-stable)

[2] [Microsoft Learn — @minecraft/server-net Module](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-net/minecraft-server-net?view=minecraft-bedrock-experimental)
