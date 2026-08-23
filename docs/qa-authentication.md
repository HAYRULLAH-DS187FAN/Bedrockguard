# Yerel QA Authentication Senaryosu

## Amaç ve Ayrım

Bu senaryo, OAuth sağlayıcısı erişilemezken BedrockGuard’ın session, dashboard erişimi ve logout davranışını gerçek kullanıcı veya production verisine dokunmadan doğrular. QA modunda kullanılan tek kullanıcı `QA Authentication Admin` adlı bellek içi yöneticidir. Bu kullanıcı veritabanına yazılmaz; gerçek OAuth, Agent, Discord ve moderasyon yaptırımı çağrılmaz.

| Güvenlik kapısı | Davranış |
|---|---|
| İstemci | `qaAuth=1` yalnızca Vite geliştirme derlemesinde QA header’ını gönderir ve QA giriş düğmesini gösterir. |
| Sunucu | `x-bedrockguard-qa-auth: local-auth` sadece production dışındaki isteklerde kabul edilir. Production’da QA login endpoint’i `404` döndürür. |
| Session | QA endpoint’i yalnızca HttpOnly cookie üretir; response içinde token dönmez. Session 30 dakika ile sınırlıdır. |
| Kimlik | QA session open ID’si gerçek bir kullanıcı kaydına eşleşmez ve `sdk.authenticateRequest` tarafından production DB’ye erişmeden çözülür. |
| Veri | QA session etkinken dashboard ve yönetim ekranları bellek içi QA verisini kullanır. |
| Admin mutasyonları | Sunucu oluşturma, ayar kaydetme, whitelist, yaptırım isteme ve yaptırım onayı QA isteğinde simülasyon/no-op olur; production DB’ye yazmaz. |

## Çalıştırma

Geliştirme sunucusunu `pnpm dev` ile başlatın ve `/?qaAuth=1` adresini açın. Giriş ekranındaki **Yerel QA oturumuyla giriş** düğmesi QA session cookie’sini kurar. Sadece geliştirme önizlemesi için tasarlanan bu URL’yi production alanında kullanmayın; production derlemesinde düğme ve QA header’ı üretilmez.

## Doğrulanan Akış

| Adım | Sonuç |
|---|---|
| QA login simülasyonu | Geçti — test kullanıcısı ile HttpOnly QA session oluşturuldu ve dashboard açıldı. |
| Sayfa yenileme | Geçti — dashboard `QA Authentication Admin` yöneticisiyle açık kaldı. |
| Doğrudan korumalı rota | Geçti — `/players?qaAuth=1` rota koruması sonrası QA oyuncu listesi görüntülendi. |
| Logout | Geçti — session temizlendikten sonra login ekranına dönüldü. |
| Logout sonrası korumalı rota | Geçti — aynı oyuncu rotası dashboard verisi yerine login ekranını gösterdi. |
| Otomatik test | Geçti — QA login/session/refresh/protected/logout senaryosu, cookie, production QA endpoint/context reddi ve auth testleriyle toplam 30 test başarılıdır. |

## Önceki Login Döngüsü ve Düzeltmeler

Önceki döngünün başlıca nedenleri, proxy arkasındaki callback’in `Secure` niteliği olmadan `SameSite=None` cookie üretme olasılığı ve herhangi bir tRPC hata yanıtında istemcinin tekrar OAuth akışı başlatmasıydı. Production session cookie’si artık proxy HTTPS bilgisi eksik olsa da `Secure` kalır. İstemci artık hata gördüğünde OAuth nonce’unu otomatik yenilemez; kullanıcı girişini yalnızca bilinçli giriş aksiyonu başlatır.

Preview otomatik oturumunda ayrıca kimliği doğrulanmış ancak `admin` olmayan bir kullanıcı durumu gözlendi. Sahip hesabı eski bir kullanıcı rolünde kaldıysa auth sırasında idempotent biçimde yönetici rolüne iyileştirilir. Header debug kaydı da Authorization/Cookie alanlarını maskeler.

## Değiştirilen Bileşenler

| Dosya / bileşen | Sorumluluk |
|---|---|
| `server/guard/qa.ts` | QA header kapıları, QA test kullanıcısı ve bellek içi yönetim verisi. |
| `server/_core/qaAuth.ts` | Sadece geliştirmedeki QA login endpoint’i ve 30 dakikalık HttpOnly QA session üretimi. |
| `server/_core/sdk.ts` | QA session’ı production DB’ye erişmeden çözme; sahip rolü iyileştirmesi. |
| `server/_core/cookies.ts` | Production proxy arkasında Secure session cookie zorlaması. |
| `server/_core/index.ts` | QA auth route kaydı. |
| `server/routers.ts` | QA auth isteklerinde veri okuma ve tüm admin mutasyonları için simülasyon/no-op koruması. |
| `client/src/main.tsx` ve `DashboardLayout.tsx` | Geliştirme QA header’ı ve QA login kontrolü. |
| `client/src/const.ts`, `useAuth.ts` | Safari/WebView nonce ve storage dayanıklılığı. |
| `client/public/__manus__/debug-collector.js` | Request/response header maskelemesi. |
| `server/auth.qa-flow.test.ts` | QA login, yenileme, korumalı rota, logout ve yazmasız mutasyon testi. |

## Canlı OAuth Sınırı

Gerçek `Login → OAuth callback → Dashboard → Refresh → Logout → protected route engeli` akışı bu teslim sırasında **başarılıymış gibi raporlanmamıştır**. OAuth sağlayıcısı planlı bakımda olduğundan canlı akış henüz yürütülemedi. Sağlayıcı yeniden erişilebilir olduğunda aynı beş adım preview alanında tekrar doğrulanmalıdır.
