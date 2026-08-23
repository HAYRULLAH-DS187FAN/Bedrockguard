# P1–P3 Gölge Mod Doğrulama Kaydı

## Doğrulanan masaüstü akışı

23 Ağustos 2026 tarihinde yerel geliştirme QA oturumuyla **Gölge gözlem merkezi** ekranı açıldı. Ekranda iki bellek içi QA kaydı görünür durumdaydı: Floodgate kaynaklı `bedrock_geyser` hız adayı çevresel bambu ve jitter bağlamıyla **Bastırıldı**; Java kaynaklı fly adayı **Gözlem** olarak saklandı.

| Kontrol | Sonuç |
|---|---|
| Yaptırım durumu | Ekranda açık biçimde “Yaptırım kapalı” olarak görünür. |
| Kanıt ayrımı | Gözlem/bastırma, kaynak, platform, şiddet, kanıt kalitesi ve platform uyumu ayrı gösterilir. |
| Veri minimizasyonu | Ekran ham paket veya konum izi göstermediğini belirtir; yalnızca bağlam özeti görünür. |
| Rol koruması | Ekran, yerel QA yöneticisi oturumu ile açıldı; tRPC sorguları yönetici prosedürü arkasındadır. |

Bu doğrulama, QA verileriyle yapılmıştır ve production veritabanına kayıt yazmaz. Mobil genişlik doğrulaması son kontrol aşamasında aynı QA oturumu ile tamamlanacaktır.
