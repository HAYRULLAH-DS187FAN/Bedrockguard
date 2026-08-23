# BedrockGuard’ı Vercel’de Çalıştırma

Bu proje React/Tailwind arayüzünü, tRPC API’sini ve imzalı Agent uçlarını Vercel’de çalıştırır. Yönetim paneline kullanıcı hesabı, e-posta/parola veya OAuth ile giriş yapılmaz; yalnızca sunucu sahibine verilen ayrı erişim anahtarı ile oturum açılabilir. Kök Function adapter’ı Express uygulamasını Vercel Function olarak çalıştırır; `build:vercel` istemci çıktısını CDN tarafından sunulacak `/public` dizinine üretir.[1][2]

## Ön koşullar

| Gereksinim | Açıklama |
|---|---|
| GitHub/GitLab/Bitbucket deposu | Projeyi Vercel’e bağlamak için. |
| MySQL/TiDB bağlantısı | Vercel’den erişilebilen TLS destekli bir `DATABASE_URL`. Bu proje MySQL uyumlu Drizzle şemasını kullanır. |
| Güçlü oturum anahtarı | En az 32 karakterlik, production’a özel `JWT_SECRET`. |
| Sunucu sahibi erişim anahtarı | En az 16 karakterlik, benzersiz `SERVER_OWNER_ACCESS_KEY`. Bu değeri yalnızca güvenilir sunucu sahibine güvenli bir kanaldan verin. |

> Vercel Functions istek trafiğine göre ölçeklenir; kalıcı process, yerel disk, in-memory queue veya sürekli bağlantı varsayımıyla çalışmaz.[1] BedrockGuard’ın Agent olayları ve tRPC istekleri HTTP tabanlı olduğundan bu modelle uyumludur; veritabanı bağlantınız dışarıdan erişilebilir olmalıdır.

## Vercel proje ayarları

1. Depoyu Vercel’de yeni projeye bağlayın.
2. Framework Preset’i **Other** bırakın. Depodaki `vercel.json`, `pnpm build:vercel` komutunu ve `public` çıktısını zaten tanımlar.
3. Aşağıdaki değişkenleri **Production** ve gerektiği yerde **Preview** ortamına ekleyin.
4. İlk dağıtımdan önce MySQL/TiDB hedefinde Drizzle migration’larını güvenli biçimde uygulayın. Migration’ı Vercel Function başlangıcında çalıştırmayın.
5. Kullanılmayan `LOCAL_ADMIN_EMAIL`, `LOCAL_ADMIN_PASSWORD`, `VITE_APP_ID`, `OAUTH_SERVER_URL` ve `VITE_OAUTH_PORTAL_URL` değerlerini bu giriş modeli için eklemeyin. `SERVER_OWNER_ACCESS_KEY` değerini sohbet, Git veya istemci kodu ile paylaşmayın.

| Ortam değişkeni | Gizli mi? | Kullanım |
|---|---:|---|
| `DATABASE_URL` | Evet | MySQL/TiDB bağlantısı. |
| `JWT_SECRET` | Evet | En az 32 karakterlik, yalnız oturum imzalamada kullanılan production sırrı. Silmeyin veya kısa bir değer kullanmayın. |
| `SERVER_OWNER_ACCESS_KEY` | Evet | En az 16 karakterlik sunucu sahibi giriş anahtarı. Girişin tek production yoludur. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Evet | Mevcut Manus depolama/yardımcı servis adaptörleri kullanılıyorsa. Harici Vercel projesinde bunların yerine bağımsız sağlayıcı adaptörü gerekir. |

## Sunucu sahibi anahtarıyla giriş

Sunucu sahibi `https://<alan-adiniz>` adresini açar, **Sunucu sahibi erişim anahtarı** alanına kendisine güvenli bir kanaldan iletilen anahtarı girer ve **Anahtarla giriş yap** düğmesini kullanır. Başarılı giriş, `HttpOnly`, `Secure` ve `SameSite=None` nitelikli 4 saatlik oturum çerezi üretir. Anahtarın kendisi yeniden kullanılabilir bir paylaşılan sırdır; tek kullanımlık kod değildir.

Anahtar yanlış girilirse hata verilir. Bir IP adresinden art arda beş hatalı denemede, ilgili Function örneğinde 15 dakikalık geçici kilit uygulanır. Vercel Functions ölçeklenebildiğinden bu kilit, dağıtık/global bir kaba kuvvet koruması değildir; daha güçlü global sınır istenirse Redis veya benzeri kalıcı bir rate-limit altyapısı eklenmelidir.[1]

Anahtarı iptal etmek veya değiştirmek için Vercel proje ayarlarında `SERVER_OWNER_ACCESS_KEY` değerini değiştirin ve yeniden dağıtım yapın. Anahtarın SHA-256 parmak izi oturum kimliğine dahil edildiği için, eski anahtarla oluşturulmuş oturumlar yeni dağıtımda geçersiz olur. `JWT_SECRET` değerini değiştirmeniz de tüm imzalı oturumları geçersiz kılar; yalnızca acil küresel oturum sonlandırma gerektiğinde değiştirin.

## Rota davranışı

`vercel.json`, SPA derin bağlantılarını (`/players/...`, `/observations`, `/settings`) `index.html`’e yönlendirir ve `/api/*` ile `/manus-storage/*` yollarını bu fallback’in dışında tutar. Vercel’in algıladığı `api/index.js` Function girişine yapılan rewrite, özgün yolu güvenli query parametreleriyle adapter’a taşır; adapter Express çağrısından önce tRPC, OAuth, Agent ve storage proxy yollarını geri yükler. `build:vercel`, ESM-only bağımlılıklarla uyum için iç TypeScript modüllerini `server/vercel.ts` üzerinden tek bir ESM bundle’ına dönüştürür. Vite SPA’larında derin bağlantı için rewrite gerektiği Vercel tarafından belgelenmiştir.[2]

| Yol grubu | Vercel’de davranış |
|---|---|
| `/*` arayüz rotaları | CDN’den `index.html` ve Vite asset’leri; Wouter istemci yönlendirmesi. |
| `/api/trpc/*` | Kök Express Function üzerinden tRPC. |
| `/api/agent/*` | Kök Express Function üzerinden imzalı Agent API. |
| `/manus-storage/*` | Mevcut Forge storage proxy’si; dış Vercel kullanımında bağımsız storage adaptörü gerektirir. |

## Yerel ve preview doğrulama

Vercel CLI ile `vercel dev` çalıştırın; ardından bilinçli yanlış anahtarda **“Erişim anahtarı geçersiz”** yanıtını, doğru anahtarla dashboard açılışını, yenilemede oturumun korunmasını, çıkıştan sonra panele erişimin kapanmasını, `/api/trpc` sorgularını, `/api/agent/events` HMAC doğrulamasını ve SPA derin bağlantılarını kontrol edin. Vercel’in resmi Express kılavuzu Express uygulamasının tek Function olarak çalıştığını, statik içerik için `public/**` kullanılmasını belirtir.[1]

## Bilinen sınırlar

Bu uyarlama **arayüzü ve HTTP tabanlı BedrockGuard davranışını** Vercel hedefi için hazırlar. Vercel dashboard erişimi yalnızca `SERVER_OWNER_ACCESS_KEY` ile oluşturulan oturumlara izin verir; eski OAuth, e-posta/parola ve veritabanı kullanıcı oturumları bu panelde kabul edilmez. Forge storage veya built-in servis anahtarları kullanılıyorsa bunlar Vercel hesabına otomatik taşınmaz; harici Vercel kullanımında bağımsız bir servis adaptörü gerekir.

## Kaynaklar

[1] [Vercel — Express on Vercel](https://vercel.com/docs/frameworks/backend/express)

[2] [Vercel — Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
