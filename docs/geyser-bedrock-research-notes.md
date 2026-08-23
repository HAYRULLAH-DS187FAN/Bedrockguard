# Geyser ve Bedrock Araştırma Notları

## Birincil Kaynak Bulguları

| Kaynak | Doğrulanan bulgu | Tasarıma etkisi |
|---|---|---|
| GeyserMC – AntiCheat Compatibility | GeyserMC, anti-cheat uyumluluğunu Bedrock oyuncularını doğru kontrol eden, Bedrock’u kısmen yok sayan ve Bedrock’ta yanlış pozitif üreten ürünler olarak ayırır. Liste topluluk derlemesidir; uygunluk garantisi değildir. | Bedrock trafiği Java kurallarıyla tek profil altında değerlendirilmemeli; oyuncu platformu ve sürümünü karar girdisi yapmak gerekir. |
| GeyserMC – Current Limitations | Geyser’in iki farklı kod tabanı/protokol arasında çeviri yaptığı; Java ve Bedrock arasındaki offset farkları nedeniyle bambu çevresinde hareket sorunu bulunduğu belirtilir. | Hareket kontrolleri çevresel bağlam, blok durumu ve protokol çeviri etkisini kanıt paketine katmalıdır. Tek teleport/sapma otomatik yaptırım için yeterli değildir. |
| GeyserMC – Getting Started with the API | `GeyserApi.api().connectionByUuid(uuid)` Bedrock/Geyser bağlantısını sorgulamak için örneklenmiştir; bağlantı yoksa `null` dönebilir. Floodgate için `FloodgateApi.isFloodgatePlayer(uuid)` önerilir. | Agent adaptörü oyuncunun kaynak platformunu tahmine dayalı isim öneki yerine Geyser/Floodgate işaretinden üretmelidir. |
| GeyserMC – Floodgate API | Floodgate API, çevrimiçi oyuncunun Bedrock oyuncusu olup olmadığını ve `FloodgatePlayer` bilgisini sağlayabilir; proxy mimarisinde backend’e veri aktarımı için ek yapılandırma gerekir. | Çok sunuculu kurulumda platform kökeni için yetkili kaynak proxy/Geyser katmanı olmalı; aktarılan profil imzalı olay şemasında doğrulanmalıdır. |
| GeyserMC/Geyser #460 | Eski fakat açıkça belgelendirilmiş vaka: Bedrock istemcisiyle Java sunucusuna bağlanan oyuncu sprint-jump sırasında hız/düzensiz hareket nedeniyle anti-cheat kick’i almıştır. Konu, Bedrock oyun mekaniği farklarına ve hareket/konum tutarsızlıklarını izleyen çalışmalara bağlanmıştır. | Bu vaka üretim oranı veya güncel davranış garantisi değildir; ancak Speed/Fly kuralının Bedrock kimliği olmadan otomatik yaptırıma bağlanmaması gerektiğine dair somut risk örneğidir. |
| GeyserMC – FloodgatePlayer | `FloodgateApi#getPlayer(uuid)`, Floodgate üzerinden bağlanan oyuncunun Bedrock istemci verisini tutan `FloodgatePlayer` nesnesine erişir. Belge, hangi alt alanların tüm sürümlerde sabit sözleşme olduğunu ayrıntılandırmaz. | Cihaz/istemci sürümü gibi özellikler kullanılmadan önce kurulu Floodgate sürümünün API sözleşmesiyle doğrulanmalı; minimum güvenli profil `isFloodgatePlayer` + oyuncu UUID’sidir. |

## Kaynaklar

1. https://geysermc.org/wiki/geyser/anticheat-compatibility/
2. https://geysermc.org/wiki/geyser/current-limitations/
3. https://geysermc.org/wiki/geyser/getting-started-with-the-api/
4. https://geysermc.org/wiki/floodgate/api/
5. https://github.com/GeyserMC/Geyser/issues/460
6. https://geysermc.org/wiki/floodgate/player/
