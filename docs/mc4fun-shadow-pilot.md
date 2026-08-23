# MC4FUN Bedrock-aware Gölge Mod Pilot Rehberi

## Amaç ve açık kapsam sınırı

Pilotun amacı, MC4FUN üzerindeki Java, doğrudan Bedrock ve Geyser/Floodgate Bedrock oturumlarından gelen hareket telemetrisinin **yanlış pozitif riskini ölçmektir**. P1–P3 sürümünde Speed, Fly ve `packet_integrity` yalnızca aday kanıt türüdür. Hiçbiri şüphe puanı değiştiremez, yaptırım oluşturamaz, Agent komutu kuyruğa koyamaz veya Discord'a moderasyon bildirimi gönderemez.

| Kapsamda | Bilinçli olarak kapsam dışında |
|---|---|
| Platform ailesi ve kaynağı | Otomatik kick/ban |
| Örnek penceresi, ölçüm kaynağı, ağ/çevre bağlamı | Packet spoofing hükmü |
| Gözlem / bastırma ve sebep | Ham paket veya tam konum izi saklama |
| Yönetici görünürlüğü ve haftalık inceleme | P4 yaptırım eşikleri |

Geyser, iki farklı oyun ve kod tabanı arasında çeviri yaptığı için hareketin bağlamdan bağımsız yorumlanması güvenli kabul edilmez; resmi sınırlamalar belgelenmiştir.[1] Geyser'ın anti-cheat uyumluluk listesi de farklı eklentilerde Bedrock yanlış pozitif riskinin topluluk tarafından bildirildiğini belirtir.[2]

## Kurulum sırası

1. **Ön koşul:** Geyser/Floodgate ve ilgili proxy topolojisinin çalıştığını MC4FUN yöneticisi doğrular. Adaptör yalnızca sunucunun sahip olduğu UUID ve bağlantı bağlamıyla çalışır.
2. **Adaptörü kurun:** `docs/geyser-floodgate-adapter-contract.md` sözleşmesine göre Floodgate/Geyser tarafında `clientFamily`, `source` ve güven değerini üretin. Eşleşme belirsizse `unknown` gönderin; Java varsaymayın.[3]
3. **Bridge'i güncelleyin:** İmzalı Bridge, `platform` ve `shadowObservation` alanlarını relayed eder. Agent anahtarı yalnızca sunucu tarafında tutulur.
4. **Kademeli doğrulama:** Önce bir test oyuncusunda 30 dakika gözlem alın. Ardından kontrollü Bedrock/Geyser oturumlarıyla su, bambu, taşıt, elytra, piston/itme ve teleport senaryolarını gözleyin.
5. **Panel kontrolü:** Yönetici yalnızca **Gölge gözlemleri** ekranından gözlem/bastırma oranını inceler. Bir gölge kaydına dayanarak yaptırım istenmez.

## Veri minimizasyonu ve kill switch

Saklanan bilgi; oyuncu UUID/adı, platform ailesi, kaynak, güven yüzdesi, aday türü, toplu örnek ölçüleri, çevre/etki bayrakları ve bastırma nedenidir. Ham paketler, IP adresleri, cihaz ayrıntıları ve tam konum dizileri varsayılan olarak saklanmaz. `positionTraceDigest` kullanılacaksa yalnızca kısa, geri döndürülemez bir özet olmalıdır.

Pilotun **kill switch'i**, Geyser/Floodgate adaptörünün hareket `shadowObservation` üretimini durdurmasıdır. Bu işlem mevcut sohbet moderasyonunu, normal admin panelini veya kimlik akışını değiştirmez. Bridge'in platform profili yayınını da durdurmak istenirse adaptör kapatılır; eksik profil varsayılan olarak `unknown` kabul edilir ve hareket gözlemi bastırılır.

## Haftalık inceleme rubriği

| Metrik | İnceleme sorusu | P4 öncesi karar ölçütü |
|---|---|---|
| Platform dağılımı | `unknown` payı yükseliyor mu? | Kaynak/veri iletimi düzelmeden ilerleme yok. |
| Bastırma oranı | Hangi çevre veya ağ koşulu baskın? | Bağlam kuralları gözden geçirilir; yaptırım açılmaz. |
| Geyser–Java farkı | Aynı aday türünde kalite/uyum farkı var mı? | Ayrı toleranslar ancak yeterli örnekle önerilir. |
| İnceleme notları | Gerçek hile iddiası bağımsız kanıtla doğrulandı mı? | Telemetri tek başına karar kanıtı değildir. |

> Tarihsel bir Geyser kaydında Bedrock sprint-zıplama davranışının hız/irregular-movement uyarılarıyla ilişkilendirildiği görülür; bu evrensel veya güncel bir hüküm değildir, pilotta izlenecek risk örneğidir.[4]

## Geri alma ve P4 geçiş kapısı

Pilot sırasında beklenmeyen yük, kimlik eşleşme hatası veya veri minimizasyonu ihlali görülürse adaptör kapatılır; saklanan gözlemler korunur ancak yeni hareket telemetrisi alınmaz. P4 ve her tür yaptırım tasarımı, en az bir haftalık gözlem verisi, platform başına yeterli örnek, bastırma nedenlerinin gözden geçirilmesi, yöneticinin yazılı onayı ve ayrı bir güvenlik değerlendirmesi olmadan ele alınmaz.

## Kaynaklar

[1] [Geyser current limitations](https://wiki.geysermc.org/geyser/current-limitations/)

[2] [Geyser anti-cheat compatibility](https://wiki.geysermc.org/geyser/anticheat-compatibility/)

[3] [Floodgate API](https://wiki.geysermc.org/floodgate/api/)

[4] [Geyser issue #460: sprint-jump / speed-kick historical report](https://github.com/GeyserMC/Geyser/issues/460)
