# Preview OAuth Oturum Kurtarma Raporu

## Kök Nedenler

Preview ortamında üç ayrı durum, kullanıcı tarafında “giriş yapıldı ancak tekrar login ekranına dönüldü” algısına yol açabiliyordu. İlk olarak, callback isteği TLS’i proxy üzerinde sonlandırdığında Express’in HTTPS bilgisini görememesi mümkündü. Önceki cookie seçeneği bu durumda `Secure=false` üretebiliyordu. `SameSite=None` olan bir session cookie, `Secure` niteliği olmadan Chrome ve Safari tarafından kabul edilmez; callback başarılı görünse bile sonraki `auth.me` isteği sessionsız kalır.

İkinci olarak, istemci sorgu önbelleği herhangi bir `Please login (10001)` hatasında otomatik olarak yeni bir OAuth akışı başlatıyordu. Bu, callback dönüşü veya geçici bir istek hatasıyla çakışarak tek kullanımlık OAuth nonce’unu yenileyip dönüş akışını tekrar başlatabilirdi. Giriş artık yalnızca kullanıcı tarafından seçilen güvenli giriş aksiyonuyla başlar.

Üçüncü olarak, preview otomatik oturumunda geçerli bir kullanıcı tokenı ile `dashboard.overview` isteğinin `10002` yönetici yetkisi hatası verdiği gözlendi. Bu bir session hatası değil, mevcut kullanıcı satırının `user` rolünde kalmasıydı. Sahip hesabı, her başarılı auth isteğinde idempotent biçimde `admin` rolüne iyileştirilir.

## Uygulanan Düzeltmeler

| Katman | Değişiklik | Etki |
|---|---|---|
| Session cookie | Production’da `Secure=true` zorunlu; proxy HTTPS başlığı varsa geliştirmede de korunur. | `SameSite=None` cookie’nin tarayıcı tarafından reddedilmesini önler. |
| İstemci yönlendirmesi | Her tRPC hatasında otomatik OAuth başlatma kaldırıldı. | Callback/nonce yarışını ve hata kaynaklı login döngüsünü önler. |
| Safari/WebView | `randomUUID` için `getRandomValues` fallback’i; `localStorage` yazımı korumalıdır. | Eski Safari/WebView ve kısıtlı storage ortamlarında auth kabuğunun çökmesini önler. |
| Yetkilendirme | Sahip hesabı eski `user` rolündeyse authenticated request sırasında `admin` yapılır. | Geçerli preview/OAuth session’ın dashboard yetkisinde takılmasını önler. |
| Günlükleme | Debug collector request/response header’larını maskeleyerek kaydeder. | Authorization bearer veya cookie türevlerinin günlükte görünmesini engeller. |

## Admin Rolü Kalıcılığı

Kullanıcının her girişten sonra tekrar `user` olması, `server/db.ts` içindeki `upsertUser` fonksiyonundan kaynaklanıyordu. OAuth/preview session yenilemesi açık bir rol talep etmese bile fonksiyon, sahip olmayan her kullanıcı için `role: "user"` üretiyor ve bunu duplicate-key update içinde veritabanına yazıyordu. Böylece yönetim arayüzünden manuel olarak verilmiş `admin` rolü sonraki girişte eziliyordu.

Bu güncellemede `buildUserUpsert` rolü yalnızca açıkça istenmişse veya sahip hesabı için yönetici iyileştirmesi gerekiyorsa duplicate-key update’e ekler. Sıradan login/yenileme isteği sadece kimlik/son giriş bilgilerini günceller; mevcut admin rolü korunur. `server/auth.role-persistence.test.ts` bu davranışı hem manuel atanmış admin hem de sahip hesabı için doğrular.

## Doğrulamalar

`pnpm test` ile 32 test başarılıdır. Session token üretim/doğrulama, geçersiz token reddi, production proxy cookie seçenekleri, logout cookie temizliği, QA session izolasyonu ve admin rolü kalıcılığı otomatik olarak kapsanır. `pnpm check` ve üretim derlemesi başarıyla tamamlandı.

Preview doğrudan dashboard ve oyuncu rotaları için auth kabuğu yüklendi. Otomatik preview token akışında kullanıcı kimliği doğrulamasının çalıştığı, yönetici olmayan rolün ise açık bir `10002` yetki hatası ürettiği doğrulandı. Debug redaction denetiminde yeni bir sentetik Authorization header kaydı maskelendi ve ham bearer değeri kaydedilmedi.

## Live OAuth Sınırı

Bu doğrulama sırasında OAuth portalı, planlı bakım sayfasına yönlendirdiği için gerçek sağlayıcı üzerinden `login → callback → refresh → logout → tekrar login` zinciri canlı olarak tamamlanamadı. Kod seviyesindeki callback, session ve logout sözleşmeleri test edildi; sağlayıcı tekrar erişilebilir olduğunda bu beş adımın gerçek cihaz ve preview alanında yeniden yürütülmesi gerekir.
