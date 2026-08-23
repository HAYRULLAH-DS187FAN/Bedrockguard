# Yerel QA Ortamı ve Mobil Doğrulama Raporu

## Çalıştırma ve Temizleme

Yerel QA senaryosu yalnızca geliştirme sunucusunda çalışır. `pnpm dev` sonrasında uygulamayı `/?qa=1` ile açın. Aynı query parametresini oyuncu, yaptırım, ayarlar ve whitelist rotalarına da taşıyın. Uygulama başlığındaki **Yerel QA · Çık** düğmesi `qa=1` parametresini kaldırır ve hemen normal veri akışına döner.

> QA kayıtları bellekte tanımlanır; herhangi bir veritabanı tablosuna eklenmez. Geliştirme sunucusunun kapatılması veya QA query parametresinin kaldırılması, QA görünümünü tamamen temizler. Ayrı bir SQL temizleme işlemi gerekmez ve production verisiyle karışma riski oluşturmaz.

| Koruma katmanı | Uygulama |
|---|---|
| İstemci kapısı | QA başlığı yalnızca Vite geliştirme derlemesinde ve URL’de `qa=1` bulunduğunda eklenir. |
| Sunucu kapısı | Sunucu, `NODE_ENV=production` iken QA isteğini kabul etmez; bir başlık tek başına yeterli değildir. |
| Veri katmanı | Senaryo `server/guard/qa.ts` içinde bellek içi nesnelerden oluşur; Drizzle/SQL çağrısı yapmaz. |
| Yan etkiler | QA modunda yaptırım, yaptırım doğrulama, whitelist ekleme/silme ve ayar kaydetme istekleri kısa devre olur. Agent, Discord veya gerçek ban/kick işlemi çağrılmaz. |
| Görsel ayrım | Uygulama başlığı yerel QA modunu amber rozetle açıkça gösterir; normal moda dönüş düğmesi aynı rozet üzerindedir. |

## QA Veri Seti

Senaryoda yalnızca açıkça etiketlenmiş, gerçek oyuncu gibi görünmeyen kayıtlar kullanıldı.

| Kayıt | Şüphe puanı | Durum | Kanıt / yaptırım |
|---|---:|---|---|
| `QA_Alex_Risk` | 84 | Online | Reklam bağlantısı, olağan dışı hareket, taciz sinyali; bekleyen kick ve geçici ban incelemesi. |
| `QA_Beta_Spam` | 53 | Online | Flood/spam olayı; QA simülasyonunda yürütülmüş uyarı kaydı. |
| `QA_Gamma_Trusted` | 12 | Offline | Whitelist koruması ve düşük riskli olay. |

Yüksek riskli `QA_Alex_Risk` ayrıntı ekranında üç olay, üç tespit rozeti ve iki yaptırım geçmişi bulunur. Dashboard; iki online oyuncu, bir yüksek riskli oyuncu, iki onay bekleyen kayıt ve son 24 saate ait beş olayı gösterir.

## Responsive QA Matrisi

| Ekran | 360px | 390px | 412px | 768px | 1024px | 1440px |
|---|---|---|---|---|---|---|
| Dashboard kartları ve risk/yaptırım listeleri | Geçti | Geçti | Geçti | Geçti | Geçti | Geçti |
| Oyuncu listesi | Geçti | Geçti | Geçti | Geçti | Geçti | Geçti |
| Oyuncu detay / dolu kanıt zaman çizelgesi | Geçti | Geçti | Geçti | Geçti | Geçti | Geçti |
| Yaptırım geçmişi ve doğrulama düğmeleri | Geçti | Geçti | Geçti | Geçti | Geçti | Geçti |
| Kurallar / AI / Discord ayar formu | Geçti | Geçti | Geçti | Geçti | Geçti | Geçti |
| Whitelist formu ve kayıt listesi | Geçti | Geçti | Geçti | Geçti | Geçti | Geçti |
| Mobil alt menü ve QA’dan çıkış denetimi | Geçti | Geçti | Geçti | N/A | N/A | N/A |

Ekranlar 360×800, 390×844, 412×915, 768×1024, 1024×900 ve 1440×1000 görünüm alanlarında veri dolu QA senaryosuyla yakalandı. QA tRPC çağrıları 200 yanıt verdi; en son istemci günlüklerinde `TypeError`, `ReferenceError`, CORS veya başarısız API çağrısı görülmedi.

## Mobilde Bulunan ve Düzeltilen Sorunlar

Oyuncu listesi ve yaptırım ekranları, telefon genişliklerinde yatay taşmaya yol açan sabit grid sütunlarına sahipti. Bu ekranlar artık 640px altındaki görünümde kart düzenine geçer. Ayarlar ekranında daha eski iOS Safari sürümlerinde sorun çıkarabilecek `structuredClone()` ve `Array.prototype.at()` bağımlılıkları kaldırıldı. Viewport, safe-area, dinamik görünüm yüksekliği, 16px mobil input metni ve minimum 44px dokunma alanları da eklendi.

Oyuncu detay API’si `NOT_FOUND` döndürdüğünde ekranın belirsiz bir yükleme görünümünde kalmaması için anlaşılır hata ve geri dönüş aksiyonu eklendi. QA senaryosu bu sayfanın gerçek veri dolu halini de doğrulamak için kullanıldı.

## Otomatik Doğrulamalar

`pnpm test` ile 18 test başarıyla tamamlandı. Bunlar moderasyon çekirdeğini, imzalı Agent kontrollerini, QA veri kapsamını ve QA modundaki yaptırım/whitelist mutasyonlarının veritabanına dokunmadan kısa devre olmasını kapsar. `pnpm check` ve `pnpm build` de başarıyla tamamlandı.

## Kalan Sınırlar

Bu ortamda doğrudan fiziksel Android Chrome veya iOS Safari otomasyonu bulunmadığından, mobil testler Chromium tabanlı responsif görünüm yakalamaları ve WebKit uyumluluk denetimleriyle gerçekleştirildi. Gerçek cihazda giriş sağlayıcısı, kurumsal ağ, Safari gizlilik ayarları veya WebView kaynaklı bir sorun görülürse cihaz modeli ve tarayıcı sürümüyle yeniden incelenmelidir.

Mevcut BedrockGuard arayüzünde modal tabanlı bir akış yoktur; yaptırım ve ayar işlemleri sayfa içi, doğrulamalı kontrollerle yapılır. Bu yüzden QA’da modal yerine mevcut doğrulama butonları, form alanları ve mobil menü test edildi.
