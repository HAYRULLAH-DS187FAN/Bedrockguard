# BedrockGuard’ı Vercel’de Çalıştırma

Bu proje artık aynı React/Tailwind arayüzünü, tRPC API’sini, imzalı Agent uçlarını ve OAuth rota sözleşmesini Vercel hedefinde de kullanacak giriş noktalarına sahiptir. Kök `server.ts`, Express uygulamasını Vercel’in Node.js Function olarak algılayacağı biçimde dışa aktarır; `build:vercel` istemci çıktısını Vercel CDN tarafından sunulacak `/public` dizinine üretir.[1][2]

## Ön koşullar

| Gereksinim | Açıklama |
|---|---|
| GitHub/GitLab/Bitbucket deposu | Projeyi Vercel’e bağlamak için. |
| MySQL/TiDB bağlantısı | Vercel’den erişilebilen TLS destekli bir `DATABASE_URL`. Bu proje MySQL uyumlu Drizzle şemasını kullanır. |
| OAuth sağlayıcısı | Vercel production ve preview callback alan adlarını izinli redirect URI olarak kaydetmeniz gerekir. Mevcut Manus OAuth değerleri otomatik olarak Vercel projesine taşınmaz. |
| Güçlü oturum anahtarı | En az 32 karakterlik, production’a özel `JWT_SECRET`. |

> Vercel Functions istek trafiğine göre ölçeklenir; kalıcı process, yerel disk, in-memory queue veya sürekli bağlantı varsayımıyla çalışmaz.[1] BedrockGuard’ın Agent olayları ve tRPC istekleri HTTP tabanlı olduğundan bu modelle uyumludur; veritabanı bağlantınız dışarıdan erişilebilir olmalıdır.

## Vercel proje ayarları

1. Depoyu Vercel’de yeni projeye bağlayın.
2. Framework Preset’i **Other** bırakın. Depodaki `vercel.json`, `pnpm build:vercel` komutunu ve `public` çıktısını zaten tanımlar.
3. Aşağıdaki değişkenleri **Production** ve gerektiği yerde **Preview** ortamına ekleyin.
4. İlk dağıtımdan önce MySQL/TiDB hedefinde Drizzle migration’larını güvenli biçimde uygulayın. Migration’ı Vercel Function başlangıcında çalıştırmayın.
5. Vercel’in verdiği alan adını ve varsa özel alan adını OAuth sağlayıcısında callback URI olarak kaydedin: `https://<alan-adiniz>/api/oauth/callback`.

| Ortam değişkeni | Gizli mi? | Kullanım |
|---|---:|---|
| `DATABASE_URL` | Evet | MySQL/TiDB bağlantısı. |
| `JWT_SECRET` | Evet | İmzalı oturum çerezi. |
| `VITE_APP_ID` | Hayır / sağlayıcıya göre | OAuth uygulama kimliği ve istemci tarafı yapılandırması. |
| `OAUTH_SERVER_URL` | Evet / sağlayıcıya göre | OAuth token/user-info servisi. |
| `VITE_OAUTH_PORTAL_URL` | Hayır | İstemci giriş başlangıç URL’si. |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Evet | Sahip hesabı eşlemesi. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Evet | Mevcut Manus depolama/yardımcı servis adaptörleri kullanılıyorsa. Harici Vercel projesinde bunların yerine bağımsız sağlayıcı adaptörü gerekir. |

## Rota davranışı

`vercel.json`, SPA derin bağlantılarını (`/players/...`, `/observations`, `/settings`) `index.html`’e yönlendirir ve `/api/*` ile `/manus-storage/*` yollarını bu fallback’in dışında tutar. Vercel’in doğrulanmış `api/index.cjs` Function girişine yapılan rewrite, özgün yolu güvenli query parametreleriyle adapter’a taşır; adapter Express çağrısından önce tRPC, OAuth, Agent ve storage proxy yollarını geri yükler. `build:vercel`, iç TypeScript modüllerini Vercel Function’da çözüm sorununa yol açmaması için `server/vercel.ts` üzerinden tek bir CommonJS bundle’ına dönüştürür. Vite SPA’larında derin bağlantı için rewrite gerektiği Vercel tarafından belgelenmiştir.[2]

| Yol grubu | Vercel’de davranış |
|---|---|
| `/*` arayüz rotaları | CDN’den `index.html` ve Vite asset’leri; Wouter istemci yönlendirmesi. |
| `/api/trpc/*` | Kök Express Function üzerinden tRPC. |
| `/api/oauth/callback` | Kök Express Function üzerinden OAuth callback. |
| `/api/agent/*` | Kök Express Function üzerinden imzalı Agent API. |
| `/manus-storage/*` | Mevcut Forge storage proxy’si; dış Vercel kullanımında bağımsız storage adaptörü gerektirir. |

## Yerel ve preview doğrulama

Vercel CLI ile `vercel dev` çalıştırın; ardından OAuth callback, admin session yenilemesi, `/api/trpc` sorguları, `/api/agent/events` HMAC doğrulaması ve SPA derin bağlantılarını kontrol edin. Vercel’in resmi Express kılavuzu Express uygulamasının tek Function olarak çalıştığını, statik içerik için `public/**` kullanılmasını belirtir.[1]

## Bilinen sınırlar

Bu uyarlama **arayüzü ve HTTP tabanlı BedrockGuard davranışını** Vercel hedefi için hazırlar. Mevcut Manus OAuth, Forge storage veya built-in servis anahtarları Vercel hesabına otomatik taşınmaz; ilgili sağlayıcıların Vercel alan adını kabul etmesi ve gerekli anahtarların Vercel proje ayarlarına ayrı eklenmesi gerekir. Bu nedenle Vercel preview üzerinde gerçek OAuth’ı ancak callback URI kaydından sonra doğrulayın; doğrulanmış gibi varsaymayın.

## Kaynaklar

[1] [Vercel — Express on Vercel](https://vercel.com/docs/frameworks/backend/express)

[2] [Vercel — Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
